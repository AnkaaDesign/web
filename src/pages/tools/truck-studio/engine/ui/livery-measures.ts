/* As medidas do implemento, editadas DENTRO do editor de plotagem.
   ---------------------------------------------------------------------------
   O pedido é literal — "quero que você faça o livery e a medida do implemento
   meio que juntos, a edição das medidas deve ser direto no livery" — e a razão
   por trás dele fica clara na primeira edição: mexer na altura do baú move a
   faixa refletiva e o topo do vão da porta POR BAIXO de uma arte que já está
   desenhada. Num formulário separado isso é um número; aqui é o desenho da
   pessoa andando na tela, que é o único lugar onde o erro aparece a tempo.

   ESTE ARQUIVO É SÓ A INTERFACE. Toda a regra — o que é uma porta, o que a
   geometria aceita, como a pilha de camadas é recomposta — mora em
   `vehicle/livery-structure.ts`. Aqui há campos, formatação e um botão.

   POR QUE OS CAMPOS SÃO DE TEXTO, e não `<input type="number">`
   ---------------------------------------------------------------------------
   Porque a fonte da verdade das medidas é `implement-measure-form.tsx`, e lá o
   `MeasurementInput` tem uma semântica muito específica que o setor já usa:
   guarda centímetros, EXIBE metros com VÍRGULA, aceita ponto ou vírgula,
   entende "840" como 8,40 m e comita no blur (Enter = blur). Um campo numérico
   nativo não faz vírgula em locale nenhum de forma confiável e mudaria o gesto
   de digitação de quem mede implemento o dia inteiro. Então a semântica é
   reproduzida, não reinventada — ver `parseMetres`/`formatMetres` abaixo, que
   são a tradução direta daquele componente para metros.

   O QUE ESTA TELA NÃO DECIDE
   ---------------------------------------------------------------------------
   A LARGURA do baú (2,60 m) não é editável: é padrão, e é ela que dá o
   comprimento do painel traseiro — por isso o campo aparece desabilitado em vez
   de sumir, senão a traseira pareceria não ter medida.
   A ALTURA é do BAÚ INTEIRO, não de uma face: as três chapas são o mesmo corpo.
   E o COMPRIMENTO vale para as duas laterais ao mesmo tempo, o que faz a regra
   dos 2 cm entre Motorista e Sapo ser satisfeita por construção (ver
   SIDE_WIDTH_TOLERANCE em vehicle/livery-structure.ts). */
import { $ } from '../core/dom';
import {
  type StructureKey,
  MIN_DOOR_HEIGHT, MIN_PANEL_HEIGHT, MAX_PANEL_HEIGHT, MIN_PANEL_LENGTH,
  addDoor, getImplementMeasures, getPanelSpec, isLengthEditable,
  onMeasuresChanged, removeDoor, setImplementMeasures, updateDoor,
  isGeometryBusy, onGeometryBusy,
} from '../vehicle/livery-structure';

/* Nada de importar ../vehicle/livery daqui. O motor já carrega um ciclo de
   propósito (livery ↔ livery-editor) e um é o suficiente — ver engine/index.ts.
   Quem chama passa a face ativa; este módulo não a descobre sozinho. */
let currentKey: StructureKey = 'left';

/* Os rótulos das faces são de `vehicle/livery` — ver `SIDE_LABEL` lá, e a razão
   de não serem "esquerda/direita". Este arquivo não pode importar aquele (o
   motor já carrega um ciclo de propósito, e um basta), então a tabela é
   REDECLARADA. É o mesmo padrão dos limites do formulário no topo de
   `livery-structure.ts`: repetido, nomeado, e num só lugar por arquivo. */
const FACE_LABEL: Record<StructureKey, string> = {
  left: 'Motorista', right: 'Passageiro', rear: 'Traseira', front: 'Frente',
  /* O TETO ENTRA NA TABELA E SAI DO PAINEL. Ele é `StructureKey` desde
     2026-08-13 (é uma face de livery), mas não tem medida própria: comprimento
     e altura são do baú, largura é a largura, e porta ele não leva. O rótulo
     existe para o tipo fechar e para o dia em que houver o que medir ali; quem
     esconde a seção é `syncMeasures()`. */
  roof: 'Teto',
};

/* ---------------- a máscara do formulário de medidas ---------------- */

/** Metros → "2,78". Duas casas porque a unidade prática do setor é o cm. */
const formatMetres = (m: number) => (Number.isFinite(m) ? m : 0).toFixed(2).replace('.', ',');

/**
 * "2,78" → 2,78 · "278" → 2,78 · "2.78" → 2,78.
 *
 * A regra do número inteiro é a mesma do `MeasurementInput`, transposta para
 * metros: SEM separador e acima de 100, o que foi digitado são centímetros
 * ("840" é 8,40 m, não 840 m). O limiar é 100 e não 10 pelo mesmo motivo de lá
 * — "11" tem de continuar sendo 11 m, que é um comprimento de baú real.
 */
function parseMetres(text: string): number {
  const raw = (text || '').trim();
  if (!raw) return 0;
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  const hasSep = raw.includes(',') || raw.includes('.');
  return !hasSep && n > 100 ? n / 100 : n;
}

interface FieldOpts {
  label: string;
  value: number;
  min: number;
  max?: number;
  disabled?: boolean;
  title?: string;
  onCommit: (metres: number) => void;
}

/**
 * Um campo de medida. Comita no BLUR e no Enter, nunca a cada tecla.
 *
 * Não é preferência de estilo: cada commit recompõe a pilha de camadas e, se
 * houver rig, regenera a geometria do baú inteiro — recortando três chapas e
 * refazendo o engate. Ligar isso ao `input` faria esse trabalho a cada dígito
 * de "14,70", quatro vezes, e as três primeiras seriam medidas que ninguém
 * quis (1, 14, 14,7…). O commit no blur é o mesmo contrato do formulário.
 */
function field(o: FieldOpts): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'ctl';
  if (o.title) wrap.title = o.title;
  const name = document.createElement('span');
  name.textContent = o.label;
  const unit = document.createElement('span');
  unit.className = 'num-unit';
  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.className = 'num ms-num';
  input.value = formatMetres(o.value);
  input.disabled = !!o.disabled;
  const em = document.createElement('em');
  em.textContent = 'm';

  const commit = () => {
    let v = parseMetres(input.value);
    v = Math.max(o.min, o.max === undefined ? v : Math.min(o.max, v));
    /* Reexibe SEMPRE, mesmo sem mudança: é o que devolve "14" formatado como
       "14,00" e mostra ao usuário o número que o sistema entendeu. */
    input.value = formatMetres(v);
    o.onCommit(v);
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });
  input.addEventListener('focus', () => input.select());

  unit.append(input, em);
  wrap.append(name, unit);
  return wrap;
}

/* ---------------- a montagem ---------------- */

const body = () => $('measures-body');

/**
 * A assinatura do QUE está montado — face, número de portas e se o baú
 * redimensiona. Só ela muda a árvore de DOM.
 *
 * Existe porque as medidas mudam por dois caminhos: o usuário digitando (a
 * árvore continua a mesma, só os números mudam) e a geometria devolvendo a
 * altura ajustada ao friso. Remontar tudo no segundo caso jogaria fora o foco e
 * a seleção de texto de quem está no meio de uma edição encadeada.
 */
let signature = '';

function build() {
  const el = body();
  el.textContent = '';
  const m = getImplementMeasures();
  const spec = getPanelSpec(currentKey);
  const editableLength = isLengthEditable(currentKey);

  const hint = document.createElement('p');
  hint.className = 'insp-hint';
  hint.textContent = m.resizable
    ? 'A altura vale para o baú inteiro e é ajustada para fechar um número '
      + 'inteiro de frisos. O comprimento vale para as duas laterais.'
    : 'Este implemento não redimensiona (o bake não traz o branco de fábrica). '
      + 'As medidas abaixo alimentam só as camadas do painel.';
  el.appendChild(hint);

  el.appendChild(field({
    label: 'Altura', value: spec.height,
    min: MIN_PANEL_HEIGHT, max: MAX_PANEL_HEIGHT,
    title: 'Altura da chapa branca, do piso ao teto do baú.',
    onCommit: (v) => setImplementMeasures({ height: v }),
  }));

  el.appendChild(field({
    label: editableLength ? 'Comprimento' : 'Largura',
    value: spec.length,
    min: MIN_PANEL_LENGTH,
    disabled: !editableLength,
    title: editableLength
      ? 'Comprimento do baú. O crescimento é para TRÁS — a dianteira carrega o pino-rei.'
      : 'A largura do baú é padrão 2,60 m e não é editável; ela é o comprimento do painel traseiro.',
    onCommit: (v) => setImplementMeasures({ length: v }),
  }));

  /* A TESTEIRA NÃO CADASTRA PORTA, e por isso o bloco inteiro sai — cabeçalho,
     lista e o botão de adicionar. Não é uma face pobre: é a face que carrega o
     pino-rei, o datum imóvel do baú (ver `mapZ` em trailer-geometry.ts), e
     `pushDoorsToGeometry()` a recusa do outro lado. Um "+ Adicionar porta" que
     desenha um vão no 2D e não abre nada no 3D é pior do que a ausência dele.
     A traseira FICA: lá o cadastro alimenta a camada de layout, que é a única
     representação que aquelas portas têm no editor. */
  if (currentKey === 'front') return;

  const title = document.createElement('h4');
  title.className = 'sub-title';
  title.textContent = `Portas · ${FACE_LABEL[currentKey]}`;
  el.appendChild(title);

  if (!spec.doors.length) {
    const none = document.createElement('p');
    none.className = 'insp-hint';
    none.textContent = 'Nenhuma porta nesta face.';
    el.appendChild(none);
  }

  spec.doors.forEach((d, i) => {
    const row = document.createElement('div');
    row.className = 'ms-door';

    const head = document.createElement('div');
    head.className = 'ms-door-head';
    const label = document.createElement('span');
    label.textContent = `Porta ${i + 1}`;
    const del = document.createElement('button');
    del.className = 'mini ghost ms-door-del';
    del.type = 'button';
    del.title = 'Remover esta porta';
    del.textContent = '✕';
    del.addEventListener('click', () => { removeDoor(currentKey, i); });
    head.append(label, del);
    row.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'ms-door-grid';
    /* `position` é medido da borda ESQUERDA DO PAINEL como o palco a mostra — e
       as duas laterais correm em sentidos opostos (rótulos ◄ TRASEIRA / ◄
       FRENTE). Chamar isto de "distância da traseira" seria verdade só na
       esquerda, então o rótulo fica no que o usuário vê. */
    grid.appendChild(field({
      label: 'Posição', value: d.position, min: 0,
      max: Math.max(0, spec.length - d.width),
      title: 'Distância da borda esquerda do painel, como ele aparece aqui.',
      onCommit: (v) => updateDoor(currentKey, i, { position: v }),
    }));
    grid.appendChild(field({
      label: 'Largura', value: d.width, min: 0.05, max: spec.length,
      onCommit: (v) => updateDoor(currentKey, i, { width: v }),
    }));
    grid.appendChild(field({
      label: 'Altura', value: d.height, min: MIN_DOOR_HEIGHT, max: spec.height,
      title: 'Do piso até o topo do vão — a mesma leitura do formulário de medidas.',
      onCommit: (v) => updateDoor(currentKey, i, { height: v }),
    }));
    row.appendChild(grid);
    el.appendChild(row);
  });

  const actions = document.createElement('div');
  actions.className = 'btn-row';
  const add = document.createElement('button');
  add.className = 'mini ghost ms-door-add';
  add.type = 'button';
  add.textContent = '+ Adicionar porta';
  add.addEventListener('click', () => { addDoor(currentKey); });
  actions.appendChild(add);
  el.appendChild(actions);

  /* O CARREGAMENTO DO VÃO, AO LADO DO BOTÃO QUE O CAUSOU.
     ---------------------------------------------------------------------
     Recortar um vão de porta reescreve o corpo branco inteiro e leva alguns
     segundos (ver o bloco em studio.ts).

     Isto NASCEU como o único indicador possível: a pílula `#cab-switching` e o
     véu do viewport ficavam ATRÁS de `#editor-modal` (z-index 9 e 0 contra
     9999), ou seja invisíveis exatamente na tela em que este botão vive. Em
     2026-08-13 a pílula passou a atravessar o modal (`.ts-editing` em
     core/studio.css), a pedido — "quando adicionar porta deve ter o mesmo
     loading que há quando está carregando o mapa".

     ELE FICA MESMO ASSIM, e não é duplicação: a pílula diz que o APP está
     trabalhando, no topo da tela; esta linha diz por que ESTE botão, aqui
     embaixo à direita, está apagado. `livery-structure` publica o booleano
     (`onGeometryBusy`) e studio.ts o liga e desliga. */
  const busy = document.createElement('p');
  busy.className = 'insp-hint ms-busy';
  busy.textContent = 'Abrindo o vão no baú…';
  el.appendChild(busy);
  applyBusy();

  const note = document.createElement('p');
  note.className = 'insp-hint ms-note';
  note.textContent = 'As portas cadastradas viram vão no painel e vão para a '
    + 'geometria do baú. As faixas refletivas, os frisos e as portas ainda são '
    + 'marcações provisórias: entram como arte real assim que os SVGs chegarem, '
    + 'sem nenhuma outra mudança.';
  el.appendChild(note);
}

/**
 * Liga/desliga o estado ocupado sem remontar a árvore.
 *
 * Desabilitar os controles de porta não é enfeite: um segundo clique em
 * "+ Adicionar porta" durante o recorte enfileiraria outro recorte de três
 * segundos, e o usuário — que não vê nada acontecer — clica de novo. É o
 * caminho conhecido para um congelamento de dez segundos a partir de um
 * congelamento de três.
 *
 * Os campos de MEDIDA continuam vivos de propósito: eles já têm coalescência
 * própria (`DIMS_QUIET_MS`) e travá-los tiraria do usuário a única coisa que
 * ele pode fazer enquanto espera.
 */
function applyBusy() {
  const el = body();
  const on = isGeometryBusy();
  el.classList.toggle('is-busy', on);
  const note = el.querySelector<HTMLElement>('.ms-busy');
  if (note) note.classList.toggle('hidden', !on);
  for (const b of el.querySelectorAll<HTMLButtonElement>('.ms-door-add, .ms-door-del')) {
    b.disabled = on;
  }
}

/** Só os números, para não roubar o foco de quem está digitando. */
function syncValues() {
  const spec = getPanelSpec(currentKey);
  const values = [spec.height, spec.length];
  for (const d of spec.doors) values.push(d.position, d.width, d.height);
  const inputs = body().querySelectorAll<HTMLInputElement>('.ms-num');
  inputs.forEach((input, i) => {
    if (input === document.activeElement) return;
    if (i < values.length) input.value = formatMetres(values[i]);
  });
}

/**
 * Põe o painel de medidas em dia. Chamado pelo editor a cada troca de aba e
 * pelo próprio `livery-structure` a cada mudança de medida.
 */
export function syncMeasures(key?: StructureKey) {
  if (key) currentKey = key;
  /* ---- O TETO NÃO TEM MEDIDA PRÓPRIA, então a seção inteira some nele ----
     Comprimento e altura do baú são os MESMOS que a lateral já edita, largura
     é a largura, e porta o teto não leva — nem cadastrada nem de bake. Repetir
     ali os dois campos da lateral seria oferecer uma segunda porta de entrada
     para o mesmo número, e dois campos que escrevem o mesmo estado são a
     definição de divergir.
     Esconder e não desabilitar: um formulário cinza convida a tentar. */
  const card = document.getElementById('measures-card');
  if (card) card.classList.toggle('hidden', currentKey === 'roof');
  if (currentKey === 'roof') return;
  const m = getImplementMeasures();
  const next = `${currentKey}|${getPanelSpec(currentKey).doors.length}|${m.resizable}`;
  const faceTag = $('measures-face');
  if (faceTag) faceTag.textContent = FACE_LABEL[currentKey];
  if (next !== signature) { signature = next; build(); return; }
  syncValues();
}

export function initLiveryMeasures() {
  /* Uma inscrição só, e ela cobre os dois caminhos: a edição feita aqui e a
     volta da geometria com a altura ajustada ao friso. */
  onMeasuresChanged(() => syncMeasures());
  /* E o estado ocupado, que não passa por `onMeasuresChanged`: ele começa e
     termina sem que medida nenhuma mude. */
  onGeometryBusy(() => applyBusy());
  syncMeasures(currentKey);
}
