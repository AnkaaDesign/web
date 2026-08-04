/* Painel de ajuste da tinta.
   ---------------------------------------------------------------------------
   Dirige vehicle/paint.ts AO VIVO e grava o resultado na cor — uma linha de
   `Paint`, sob `previewConfig.truckStudio`. Como `Paint` já carrega
   `manufacturer`, gravar na linha já é gravar "aquela cor daquela montadora":
   não existe chave de montadora dentro do JSON, e não deve existir.

   POR QUE OS CAMPOS SÃO UMA TABELA E NÃO MARKUP.
   Todo campo aqui é o nome de uma propriedade de `PaintParams`. Escrever os
   <input> à mão no template daria ~30 lugares onde um nome pode divergir do
   motor, e a divergência é SILENCIOSA: setPaint() faz `if (k in params)`, então
   um `flakeSizee` não erra, só não faz nada. Declarando os campos em FIELDS,
   com a chave tipada como keyof PaintParams, o TypeScript recusa o nome errado
   na compilação.

   POR QUE "APLICAR" NÃO É "SALVAR E FECHAR".
   O painel escreve na tinta a cada arrasto do slider, então o veículo na tela
   JÁ é o resultado antes de qualquer botão. "Aplicar" só promove o que está na
   tela a padrão daquela cor no banco; "Descartar" devolve ao que estava gravado.
   Fechar sem escolher deixa o ajuste vivo na sessão e não grava nada — que é o
   comportamento que permite comparar duas cores com o mesmo ajuste.

   ESTADO É DO MOTOR, NÃO DAQUI.
   O painel nunca guarda uma cópia dos valores: lê com getPaintParams() e
   escreve com setPaint(). Espelhar em variáveis locais é exatamente como uma
   segunda superfície começa a discordar da primeira (o cabeçalho de ui/chrome.ts
   conta essa história). O único estado local é `baseline`, o que estava gravado
   quando o painel abriu, para o "Descartar" ter para onde voltar. */
import { $ } from '../core/dom';
import {
  getPaintParams, setPaint, PAINT_DEFAULTS_BY_FINISH,
  type PaintParams, type PaintFinish,
} from '../vehicle/paint';
import {
  getColor, saveColorStudio, canPersistColors, FINISH_LABEL,
  type PaintColorDef, type PaintStudioConfig,
} from '../catalog/colors';
import { setStatus } from './chrome';

/* Os parâmetros que o painel grava. É `PaintParams` inteiro MENOS `color`: a
   cor base é escolhida no passo de cor do seletor e é a identidade da linha de
   Paint — deixar o painel reescrever o hex faria "Vermelho Rubi" virar azul no
   catálogo inteiro, inclusive nos cards e no badge. */
const SAVED_KEYS = [
  'finish', 'ccGloss', 'peel', 'baseRough', 'metallic', 'flop',
  'flakeSize', 'flakeColor', 'flakeGlint',
  'pearl', 'pearlColor', 'pearlSharp', 'envMapIntensity',
] as const satisfies readonly (keyof PaintParams)[];

type SavedKey = (typeof SAVED_KEYS)[number];

interface RangeField {
  kind: 'range';
  key: Exclude<SavedKey, 'finish' | 'flakeColor' | 'pearlColor'>;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** só aparece nestes acabamentos; ausente = sempre */
  only?: PaintFinish[];
}
interface ColorField {
  kind: 'color';
  key: 'flakeColor' | 'pearlColor';
  label: string;
  hint: string;
  only?: PaintFinish[];
}
type Field = RangeField | ColorField;

interface Group { title: string; fields: Field[] }

/* Agrupado como a tinta é construída de verdade — base, floco, mica, verniz —
   e não como os uniformes estão ordenados no arquivo. */
const GROUPS: Group[] = [
  {
    title: 'Base',
    fields: [
      { kind: 'range', key: 'baseRough', label: 'Rugosidade da base', min: 0, max: 1, step: 0.01,
        hint: 'Mapeada para 0,05–0,29: um basecoat vive SOB o verniz, então é bem mais liso que uma superfície pintada nua.' },
      { kind: 'range', key: 'metallic', label: 'Carga de alumínio', min: 0, max: 1, step: 0.01,
        only: ['metallic'],
        hint: 'Metalness fica travada em 0,28 no topo. Empurrar além disso é o erro clássico que vira cromo: o three faz diffuse × (1 − metalness), e o pigmento some.' },
      { kind: 'range', key: 'flop', label: 'Flop (claro/escuro)', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'],
        hint: 'Clara de frente, escura de raspão. É a principal pista de que existe floco embaixo do verniz.' },
    ],
  },
  {
    title: 'Floco',
    fields: [
      { kind: 'range', key: 'flakeSize', label: 'Tamanho do floco', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'],
        hint: 'Floco graúdo tem lobo mais largo — o brilho acompanha o tamanho.' },
      { kind: 'range', key: 'flakeGlint', label: 'Brilho do floco', min: 0, max: 1, step: 0.01,
        only: ['metallic', 'pearl'], hint: 'Ganho do lampejo vindo da luz principal.' },
      { kind: 'color', key: 'flakeColor', label: 'Cor do floco', only: ['metallic', 'pearl'],
        hint: 'Segue a cor base sozinha até você escolher uma — e volta a seguir quando a cor base mudar.' },
    ],
  },
  {
    title: 'Perolizado',
    fields: [
      { kind: 'range', key: 'pearl', label: 'Carga de mica', min: 0, max: 1, step: 0.01,
        only: ['pearl'], hint: 'Quanto da cor de flop entra no difuso conforme a superfície vira.' },
      { kind: 'color', key: 'pearlColor', label: 'Cor de flop', only: ['pearl'],
        hint: 'Derivada girando a matiz da base em +55°, o que em QUALQUER vermelho cai em âmbar — o rubi #8d1524 deriva #856e11. É aqui que se conserta.' },
      { kind: 'range', key: 'pearlSharp', label: 'Estreiteza do flop', min: 0, max: 1, step: 0.01,
        only: ['pearl'],
        hint: 'Maior = a viagem de cor fica só na raspagem extrema, em vez de lavar a lataria inteira.' },
    ],
  },
  {
    title: 'Verniz',
    fields: [
      { kind: 'range', key: 'ccGloss', label: 'Brilho do verniz', min: 0, max: 1, step: 0.01,
        hint: 'Vira clearcoatRoughness (0,22 → 0,03).' },
      { kind: 'range', key: 'peel', label: 'Casca de laranja', min: 0, max: 1, step: 0.01,
        hint: 'Ondulação de 4–12 mm no verniz. Um reflexo perfeito é o denúncia-CG mais alto que existe.' },
      { kind: 'range', key: 'envMapIntensity', label: 'Ambiente no verniz', min: 0, max: 4, step: 0.05,
        hint: 'O controle que mais decide quanto pigmento sobra. Medido no rubi: com o verniz devolvendo o ambiente a lataria chega a h 7° s 52%; sem ele, h 359° s 64%.' },
    ],
  },
];

const FINISHES: PaintFinish[] = ['solid', 'metallic', 'pearl'];

/* ---------------- estado ---------------- */

let built = false;
let open = false;
/** o que estava GRAVADO quando o painel abriu — o destino do "Descartar". */
let baseline: PaintStudioConfig | null = null;
let currentColor: PaintColorDef | null = null;
let saving = false;

const inputs = new Map<SavedKey, HTMLInputElement>();
const rows = new Map<SavedKey, HTMLElement>();
let finishBtns: HTMLButtonElement[] = [];

/* ---------------- leitura / escrita ---------------- */

/** O recorte de PaintParams que vai para o banco. */
function currentConfig(): PaintStudioConfig {
  const p = getPaintParams();
  const out: Record<string, unknown> = {};
  for (const k of SAVED_KEYS) out[k] = p[k];
  return out as PaintStudioConfig;
}

/* Um ajuste gravado é PARCIAL: só o que foi mexido. O que falta tem de cair no
   default do acabamento, não no que está na tela — senão "Descartar" herdaria
   valores da sessão e não devolveria ao que está no banco. */
function applyConfig(cfg: PaintStudioConfig | null, color: PaintColorDef) {
  const finish = (cfg?.finish as PaintFinish | undefined) || color.finish;
  /* `finish` sai do resto para não aparecer duas vezes no literal. Os defaults
     da família entram SEMPRE, mesmo quando o acabamento não mudou: é isso que
     faz o que falta no ajuste parcial cair no padrão do acabamento em vez de
     herdar o que estava na tela. */
  const { finish: _finish, ...rest } = cfg || {};
  setPaint({
    finish,
    color: color.hex,
    ...PAINT_DEFAULTS_BY_FINISH[finish],
    ...rest,
  });
}

/* ---------------- construção ---------------- */

function buildOnce() {
  if (built) return;
  built = true;
  const body = $('paint-body');

  /* Acabamento primeiro e fora dos grupos: ele decide QUAIS grupos fazem
     sentido, e trocá-lo reescreve os parâmetros da família. */
  const fin = document.createElement('div');
  fin.className = 'ts-paint__group';
  fin.innerHTML = '<h4>Acabamento</h4>';
  const seg = document.createElement('div');
  seg.className = 'ts-paint__seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Acabamento');
  finishBtns = FINISHES.map((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ts-paint__segbtn';
    b.dataset.finish = f;
    b.textContent = FINISH_LABEL[f];
    b.addEventListener('click', () => {
      /* setPaint() reescreve os parâmetros específicos da família ao trocar de
         acabamento — é por isso que a cor base vai junto na MESMA chamada. */
      setPaint({ finish: f, color: currentColor?.hex });
      sync();
      note('');
    });
    seg.appendChild(b);
    return b;
  });
  fin.appendChild(seg);
  body.appendChild(fin);

  for (const g of GROUPS) {
    const sec = document.createElement('div');
    sec.className = 'ts-paint__group';
    sec.innerHTML = `<h4>${g.title}</h4>`;
    for (const f of g.fields) {
      const row = document.createElement('label');
      row.className = 'ts-paint__row';

      const head = document.createElement('span');
      head.className = 'ts-paint__lab';
      head.textContent = f.label;
      const val = document.createElement('i');
      val.className = 'ts-paint__val';
      head.appendChild(val);
      row.appendChild(head);

      const input = document.createElement('input');
      if (f.kind === 'range') {
        input.type = 'range';
        input.min = String(f.min);
        input.max = String(f.max);
        input.step = String(f.step);
      } else {
        input.type = 'color';
      }
      input.className = 'ts-paint__in';
      /* `input` e não `change`: o ponto do painel é a lataria reagindo enquanto
         o dedo ainda está no slider. */
      input.addEventListener('input', () => {
        const v = f.kind === 'range' ? parseFloat(input.value) : input.value;
        setPaint({ [f.key]: v } as Partial<PaintParams>);
        /* A cor do floco e a de flop são DERIVADAS da base até alguém escolher
           uma; escolher aqui congela as duas, então as duas têm de ser relidas. */
        if (f.kind === 'color') sync(); else val.textContent = fmt(f, v as number);
        note('');
      });
      row.appendChild(input);

      const hint = document.createElement('small');
      hint.className = 'ts-paint__hint';
      hint.textContent = f.hint;
      row.appendChild(hint);

      sec.appendChild(row);
      inputs.set(f.key, input);
      rows.set(f.key, row);
      (row as HTMLElement).dataset.only = f.only ? f.only.join(' ') : '';
    }
    body.appendChild(sec);
  }
}

const fmt = (f: Field, v: number) =>
  f.kind === 'range' && f.max > 1 ? v.toFixed(2) : Math.round(v * 100) + '%';

/** Reflete o motor nos controles. Nunca o contrário. */
function sync() {
  const p = getPaintParams();
  for (const b of finishBtns) {
    const on = b.dataset.finish === p.finish;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  for (const g of GROUPS) {
    for (const f of g.fields) {
      const input = inputs.get(f.key);
      const row = rows.get(f.key);
      if (!input || !row) continue;
      /* Esconder, não desabilitar: um slider de mica cinzento num acabamento
         sólido é ruído que sugere que existe algo a fazer ali. */
      const shown = !f.only || f.only.includes(p.finish);
      row.classList.toggle('hidden', !shown);
      if (f.kind === 'range') {
        const v = p[f.key] as number;
        input.value = String(v);
        const val = row.querySelector('.ts-paint__val');
        if (val) val.textContent = fmt(f, v);
      } else {
        input.value = (p[f.key] as string) || '#ffffff';
      }
    }
  }
}

function note(msg: string, bad = false) {
  const el = $('paint-msg');
  el.textContent = msg;
  el.classList.toggle('bad', bad && !!msg);
}

/* ---------------- abrir / fechar ---------------- */

function refreshHead() {
  const c = currentColor;
  $('paint-name').textContent = c ? c.name : '—';
  const bits = [FINISH_LABEL[getPaintParams().finish]];
  if (c?.code) bits.push(c.code);
  if (c?.brand) bits.push(c.brand);
  $('paint-sub').textContent = bits.join(' · ');
  ($('paint-chip') as HTMLElement).style.background = c ? c.hex : 'transparent';
}

/** Abre o painel para a cor que está no veículo. */
export function openPaintPanel(colorId: string | null | undefined) {
  buildOnce();
  const color = getColor(colorId);
  if (!color) {
    setStatus('Nenhuma cor carregada para ajustar.');
    return;
  }
  currentColor = color;
  baseline = color.studio ? { ...color.studio } : null;
  open = true;
  const panel = $('paint-panel');
  panel.classList.remove('hidden');
  panel.hidden = false;
  const btn = $('btn-paint');
  btn.classList.add('on');
  btn.setAttribute('aria-pressed', 'true');
  sync();
  refreshHead();
  note(canPersistColors() ? '' : 'Sem conexão com o catálogo: dá para ajustar, não dá para gravar.', true);
  ($('paint-apply') as HTMLButtonElement).disabled = !canPersistColors();
}

export function closePaintPanel() {
  if (!built) return;
  open = false;
  const panel = $('paint-panel');
  panel.classList.add('hidden');
  panel.hidden = true;
  const btn = $('btn-paint');
  btn.classList.remove('on');
  btn.setAttribute('aria-pressed', 'false');
}

export const isPaintPanelOpen = () => open;

/** O seletor trocou a cor: o painel aberto tem de seguir, não ficar no anterior. */
export function paintPanelColorChanged(colorId: string | null | undefined) {
  if (!open) return;
  const color = getColor(colorId);
  if (!color) return;
  currentColor = color;
  baseline = color.studio ? { ...color.studio } : null;
  sync();
  refreshHead();
  note('');
}

/* ---------------- ações ---------------- */

async function apply() {
  if (saving || !currentColor) return;
  const btn = $<HTMLButtonElement>('paint-apply');
  saving = true;
  btn.disabled = true;
  note('Gravando…');
  const cfg = currentConfig();
  try {
    await saveColorStudio(currentColor.id, cfg);
    /* O novo gravado vira o novo destino do "Descartar": depois de aplicar, o
       ajuste da tela É o do banco. */
    baseline = { ...cfg };
    note('Aplicado a ' + currentColor.name + '.');
    setStatus('Tinta de ' + currentColor.name + ' salva.');
  } catch (e: unknown) {
    note(e instanceof Error ? e.message : 'Não foi possível gravar.', true);
  } finally {
    saving = false;
    btn.disabled = !canPersistColors();
  }
}

function revert() {
  if (!currentColor) return;
  applyConfig(baseline, currentColor);
  sync();
  note(baseline ? 'Voltou ao ajuste gravado.' : 'Voltou ao padrão do acabamento.');
}

/* ---------------- ligação ---------------- */

export function initPaintPanel() {
  const panel = $('paint-panel');
  /* Mesma guarda dos outros overlays: o OrbitControls escuta no canvas e hoje
     não há caminho de bolha até ele, mas um arrasto de slider que virasse órbita
     de câmera é o tipo de defeito que só aparece depois. */
  const swallow = (e: Event) => e.stopPropagation();
  panel.addEventListener('pointerdown', swallow);
  panel.addEventListener('pointerup', swallow);
  panel.addEventListener('wheel', swallow, { passive: true });

  $('btn-paint').addEventListener('click', () => {
    if (open) { closePaintPanel(); return; }
    openPaintPanel(currentColorId);
  });
  $('paint-close').addEventListener('click', () => closePaintPanel());
  $('paint-apply').addEventListener('click', () => { void apply(); });
  $('paint-revert').addEventListener('click', () => revert());

  /* Esc fecha, e só quando este painel é o que está por cima: o editor de arte
     também escuta Esc, e dois fecharem juntos seria pior que nenhum. */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    closePaintPanel();
  });
}

/* studio.ts publica a cor corrente aqui a cada applyChoice(); o painel pode ser
   aberto antes de qualquer troca, então o valor precisa existir desde o boot. */
let currentColorId: string | null = null;
export function setPaintPanelColor(colorId: string | null) {
  currentColorId = colorId;
  paintPanelColorChanged(colorId);
}
