/* A tira de ACABAMENTOS — teto, paralamas, caixa e Thermo King.
   ---------------------------------------------------------------------------
   A interface de `vehicle/trim.ts`, e nada além disso: toda a lógica de quais
   malhas são quais, de quem segue a cor do baú e de como uma peça volta ao
   original mora lá. Aqui só há DOM.

   POR QUE ELA É DISCRETA, e o que "discreto" quis dizer concretamente. O pedido
   foi que o configurador de acabamentos fosse "mais discreto que os liveries", e
   a razão é de hierarquia: quem abre o estúdio vem plotar o baú. Acabamento é um
   ajuste que a maioria nunca toca. Então:

   · RECOLHIDA por padrão. Aberta, ela ocuparia a altura de um card de plotagem
     inteiro numa coluna que já tem três;
   · a linha recolhida CARREGA A RESPOSTA. Quatro pontinhos, um por peça, com a
     cor que cada uma está usando — quem só quer conferir não precisa abrir. Um
     cabeçalho que só dissesse "Acabamentos" obrigaria um clique para responder
     uma pergunta de meio segundo;
   · sem miniatura, sem canvas, sem prévia. Os cards de plotagem têm foto porque
     a arte é o conteúdo; aqui o conteúdo é uma cor, e uma pastilha JÁ é a cor.

   ESTADO É DO MOTOR, NÃO DAQUI. Mesma regra do painel de tinta: lê com
   `getTrim()` e escreve com `setTrim()`, e repinta a partir do que o motor
   devolveu. Nenhuma cópia local — é assim que uma segunda superfície começa a
   discordar da primeira.

   A PALETA É A MESMA DO SELETOR. `catalog/colors.ts` é a única lista de tintas
   do estúdio, e este arquivo a consome como ela está. Um segundo seletor de cor,
   com outra lista ou outra ordem, seria a mesma pergunta com duas respostas
   possíveis. O que ele acrescenta é uma opção que o seletor não tem — "Como o
   baú" / "Original" —, que é a AUSÊNCIA de cor própria e o estado padrão de
   todas as quatro peças. */
import { $, el } from '../core/dom';
import {
  TRIM_KEYS, getTrim, setTrim, trimLabel, trimHideable, trimFollowsBody,
} from '../vehicle/trim';
import type { TrimKey } from '../vehicle/trim';
import { colors } from '../catalog/colors';
import { setStatus } from './chrome';

/* A peça cuja paleta está aberta. `null` = nenhuma. UMA de cada vez: duas
   grades abertas na mesma tira dobrariam a altura do card e deixariam duas
   perguntas idênticas no ar. */
let openPalette: TrimKey | null = null;

/** O hex a mostrar na pastilha. `null` quando a peça não tem cor própria. */
const colorOf = (key: TrimKey) => getTrim()[key].color;

/**
 * O que a pastilha vazia significa, em palavras — e são duas frases diferentes
 * porque são dois comportamentos diferentes. Teto e Thermo King JÁ eram pintados
 * junto com o baú; paralamas e caixa nunca foram. Dizer "Original" para o teto
 * seria mentir: ele acompanha a cor do implemento e sempre acompanhou.
 */
const emptyLabel = (key: TrimKey) => (trimFollowsBody(key) ? 'Como o baú' : 'Original');

/** Uma pastilha de cor. Vazia (sem cor própria) é um quadriculado, não um vazio:
 *  um quadrado transparente sobre vidro escuro lê como "preto", que é uma cor. */
function swatch(hex: string | null, cls = ''): HTMLElement {
  const s = el('span', 'ts-trim__sw' + (hex ? '' : ' is-empty') + (cls ? ' ' + cls : ''));
  if (hex) s.style.background = hex;
  return s;
}

/** Os quatro pontinhos da linha recolhida. Repintados junto com o corpo. */
function paintDots() {
  const dots = $('ts-trim-dots');
  dots.textContent = '';
  for (const key of TRIM_KEYS) dots.appendChild(swatch(colorOf(key), 'ts-trim__sw--dot'));
}

/** A grade de cores de uma peça. Some ao escolher — a escolha é a saída. */
function palette(key: TrimKey): HTMLElement {
  const grid = el('div', 'ts-trim__grid');
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-label', `Cor — ${trimLabel(key)}`);

  const pick = (hex: string | null, name: string) => {
    const b = el('button', 'ts-trim__opt');
    b.type = 'button';
    b.setAttribute('role', 'option');
    const on = (colorOf(key) || null) === hex;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on) b.classList.add('is-on');
    b.appendChild(swatch(hex));
    b.title = name;
    b.setAttribute('aria-label', name);
    b.addEventListener('click', () => {
      setTrim(key, { color: hex });
      openPalette = null;
      paint();
      setStatus(`${trimLabel(key)} · ${name}`);
      /* O foco volta para a pastilha da PEÇA, não para a opção escolhida: a
         opção acabou de deixar de existir com o fechamento da grade, e um foco
         num nó removido manda o teclado para o começo do documento. */
      $(`ts-trim-sw-${key}`).focus();
    });
    return b;
  };

  /* A ausência de cor vem PRIMEIRO e é o padrão — a única opção da lista que
     não é uma tinta, e a que devolve a peça ao estado de fábrica. */
  grid.appendChild(pick(null, emptyLabel(key)));
  for (const c of colors) grid.appendChild(pick(c.hex, c.name));
  return grid;
}

/** Uma linha: pastilha + nome + (caixa e Thermo King) o olho de visibilidade. */
function row(key: TrimKey): HTMLElement {
  const wrap = el('div', 'ts-trim__row');
  const state = getTrim()[key];
  const hex = state.color;

  const sw = el('button', 'ts-trim__swbtn');
  sw.type = 'button';
  sw.id = `ts-trim-sw-${key}`;
  sw.setAttribute('aria-expanded', openPalette === key ? 'true' : 'false');
  sw.appendChild(swatch(hex));
  sw.appendChild(el('span', 'ts-trim__name', trimLabel(key)));
  sw.appendChild(el('span', 'ts-trim__val', hex ? (nameOfHex(hex) || hex) : emptyLabel(key)));
  sw.title = `Pintar ${trimLabel(key).toLowerCase()}`;
  sw.addEventListener('click', () => {
    openPalette = openPalette === key ? null : key;
    paint();
    if (openPalette === key) {
      /* O foco entra na grade recém-aberta, na opção marcada. Sem isto o
         teclado ficaria no botão e a grade seria só do mouse. */
      wrap.parentElement
        ?.querySelector<HTMLButtonElement>('.ts-trim__opt.is-on, .ts-trim__opt')?.focus();
    }
  });
  wrap.appendChild(sw);

  if (trimHideable(key)) {
    /* SÓ CAIXA E THERMO KING. Um teto ou um paralama que somem não são uma
       configuração de produto — são um caminhão quebrado. Tirar a caixa, sim:
       é uma opção real de venda, e é por isso que o olho existe. */
    const eye = el('button', 'ts-trim__eye' + (state.visible ? '' : ' is-off'));
    eye.type = 'button';
    eye.setAttribute('aria-pressed', state.visible ? 'false' : 'true');
    eye.title = state.visible
      ? `Tirar ${trimLabel(key).toLowerCase()} do implemento`
      : `Devolver ${trimLabel(key).toLowerCase()} ao implemento`;
    eye.setAttribute('aria-label', eye.title);
    eye.innerHTML = state.visible
      ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"'
        + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">'
        + '<path d="M2.6 12S6.4 5.9 12 5.9 21.4 12 21.4 12 17.6 18.1 12 18.1 2.6 12 2.6 12Z"/>'
        + '<circle cx="12" cy="12" r="2.7"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"'
        + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">'
        + '<path d="M4 4.4 19.6 19.6"/><path d="M9.6 6.2A8.6 8.6 0 0 1 12 5.9C17.6 5.9 21.4 12'
        + ' 21.4 12a15 15 0 0 1-3 3.5"/><path d="M6.5 8.1A15.3 15.3 0 0 0 2.6 12S6.4 18.1 12'
        + ' 18.1a8.9 8.9 0 0 0 3-.5"/></svg>';
    eye.addEventListener('click', () => {
      const next = setTrim(key, { visible: !state.visible });
      paint();
      setStatus(`${trimLabel(key)} · ${next.visible ? 'no implemento' : 'removido'}`);
    });
    wrap.appendChild(eye);
  }

  return wrap;
}

/** O nome de catálogo de um hex, quando ele for uma tinta da paleta. */
function nameOfHex(hex: string): string | null {
  const c = colors.find((x) => x.hex.toLowerCase() === hex.toLowerCase());
  return c ? c.name : null;
}

/** Repinta a tira inteira a partir do motor. */
function paint() {
  paintDots();
  const body = $('ts-trim-body');
  body.textContent = '';
  for (const key of TRIM_KEYS) {
    body.appendChild(row(key));
    /* A grade entra DEPOIS da linha da peça, como irmã e não como filha: ela
       ocupa a largura toda do card, e aninhada dentro da linha herdaria o
       `display:flex` dela e viraria uma quinta coluna espremida. */
    if (openPalette === key) body.appendChild(palette(key));
  }
}

export function initTrimPanel() {
  const card = $('ts-trim');
  const toggle = $<HTMLButtonElement>('ts-trim-toggle');
  const body = $('ts-trim-body');

  /* Mesma guarda que ui/hud.ts, os badges e os view controls já aplicam: o
     OrbitControls está ligado ao canvas, que é IRMÃO deste card dentro do
     holder. Hoje um clique aqui não tem caminho de bolha até lá; isto é a
     guarda para o dia em que tiver, senão escolher uma cor arrastaria a câmera
     por baixo do card. */
  const swallow = (e: Event) => e.stopPropagation();
  card.addEventListener('pointerdown', swallow);
  card.addEventListener('pointerup', swallow);
  card.addEventListener('wheel', swallow, { passive: true });

  toggle.addEventListener('click', () => {
    const open = body.classList.toggle('hidden');
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    card.classList.toggle('is-open', !open);
    /* Recolher FECHA a paleta junto. Uma grade que sobrevivesse ao recolhimento
       reapareceria aberta na próxima expansão, sobre uma decisão que o usuário
       já tinha abandonado. */
    if (open) { openPalette = null; paint(); }
  });

  paint();
}

/**
 * Repinta de fora — o catálogo de cores chega DEPOIS do boot.
 *
 * `loadColors()` é assíncrono e a tira é construída antes dele terminar, então
 * a primeira pintura vê `colors` vazio: a grade sairia com só a opção "Como o
 * baú". Chamado por studio.ts quando a paleta existir.
 */
export const refreshTrimPanel = () => paint();
