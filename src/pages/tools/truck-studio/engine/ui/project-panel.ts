/* O menu de PROJETO — novo, salvar, abrir, exportar, importar.
   ---------------------------------------------------------------------------
   CINCO NOMES, CINCO PAPÉIS. A tentação era colapsá-los em três: num navegador,
   "salvar" e "exportar" são o mesmo ato mecânico (produzir um arquivo) e "abrir"
   e "importar" também (ler um). Colapsar teria sido honesto e teria entregado
   menos. A divisão que vale é por DESTINO, não por mecânica:

     Novo       zera tudo e reabre o seletor, desde o cenário
     Salvar     ┐ a biblioteca DESTE navegador (project/store.ts, IndexedDB).
     Abrir      ┘ é o "continuo amanhã" — nome, miniatura, data
     Exportar   ┐ o arquivo .ankaastudio (project/file.ts). é o "manda para o
     Importar   ┘ Fulano" — atravessa máquina, e é o que carrega tudo junto

   E é por isso que os dois pares não são redundantes: a biblioteca é rápida e
   é privada da máquina; o arquivo é lento e é a única coisa que viaja.

   ---------------------------------------------------------------------------
   O QUE PEDE CONFIRMAÇÃO, E POR QUÊ

   Novo, Abrir e Importar DESTROEM a plotagem que está na tela, e ela pode ser o
   trabalho de uma tarde. Os três passam por uma confirmação que diz o que vai
   embora — e a confirmação some quando não há nada a perder (as cinco telas
   vazias), porque um diálogo que aparece quando não há risco é o diálogo que as
   pessoas aprendem a fechar sem ler.

   Exportar e Salvar não confirmam nada: os dois só produzem.

   ---------------------------------------------------------------------------
   O PAINEL REUSA `makePopover` DE ui/chrome.ts, e isso é deliberado: aquela
   fábrica carrega sete decisões de comportamento (quando fecha, quando NÃO
   fecha, foco de teclado, `aria-expanded`, o z-index do cluster) que foram
   descobertas uma a uma no menu de captura. Um `<div>` novo com um `click` de
   fora reintroduziria as sete. Ver o cabeçalho dela. */
import { root, $, el, errText } from '../core/dom';
import { setStatus, makePopover, claimCapture, downloadFile, isCanvasBusy } from './chrome';
import type { Popover } from './chrome';
/* A CORTINA, direto do loader. `project/document.ts` também a comanda, pelos
   ganchos que studio.ts injeta — mas quem levanta a cortina ANTES de haver
   documento (a leitura do ZIP) é esta camada, e ela não tem por que pedir isso
   emprestado ao modelo de documento. `showLoader()` é idempotente, então as duas
   mãos no mesmo volante não brigam: a segunda chamada não reinicia nada. */
/* `withPill` FICA, e só para SALVAR: gravar na biblioteca não muda um pixel da
   cena, então tomar a tela com a cortina seria desproporcional. A cortina é para
   quem REMONTA a cena — abrir e importar. */
import {
  claimPill, withPill, showLoader, setLoaderProgress, finishLoader, hideLoader,
} from './loader';

const showCurtain = (label: string) => { showLoader(); setLoaderProgress(0, label); };
const setCurtainProgress = (p: number, label?: string) => setLoaderProgress(p, label);
const finishCurtain = async () => {
  /* Sem `flyToBadge`: aqui a cortina está saindo porque NADA foi montado (erro
     de leitura ou desistência), e voar a foto para o crachá anunciaria uma troca
     de veículo que não houve. */
  try { await finishLoader({ flyToBadge: false }); }
  catch { hideLoader(); }
};
import {
  captureProject, applyProject, newProject, verifyProject,
} from '../project/document';
import type { StudioProject, ProjectProblem } from '../project/document';
import {
  writeProjectFile, readProjectFile, projectFilename, ProjectFileError, PROJECT_EXT,
} from '../project/file';
import { captureThumbnail } from '../project/thumbnail';
import * as store from '../project/store';
import { isTimelinePreviewing, stopTimelinePreview, timelineCount } from '../scene/timeline';
import { surfaces, SURFACE_KEYS } from '../vehicle/livery';

/* ---------------- o projeto ABERTO ----------------
   Só o par id+nome, e ele é o que faz "Salvar" regravar em vez de acumular uma
   cópia nova a cada clique. Zerado pelo "Novo" e escrito por Salvar/Abrir.
   Um projeto IMPORTADO entra sem id de propósito: ele ainda não é da biblioteca
   desta máquina, e o primeiro "Salvar" é que o adota — se ele já nascesse com
   id, o Salvar seguinte sobrescreveria um registro que nunca existiu. */
let openId: string | null = null;
let openName = '';

let pop: Popover | null = null;

/* ---------------- há trabalho na tela? ----------------
   A pergunta que decide se as três ações destrutivas confirmam. Conta OBJETOS,
   não pixels: uma tela com fundo de cor e nada desenhado não é trabalho que se
   lamente perder, e um único logo é. */
function artworkCount(): number {
  let n = 0;
  for (const k of SURFACE_KEYS) n += surfaces[k].getObjects().length;
  return n;
}

/* ---------------- a prévia do percurso ----------------
   O criador de vídeo dirige a câmera quadro a quadro enquanto reproduz. Toda
   ação daqui ou move a câmera (abrir, importar, novo) ou renderiza um quadro
   próprio para a miniatura (salvar, exportar) — as duas coisas brigam com uma
   reprodução em curso, e o resultado é uma prévia que salta ou uma miniatura de
   um enquadramento que ninguém pediu.

   PARA a prévia em vez de RECUSAR a ação. Recusar seria o comportamento de
   `isCanvasBusy()`, e ali está certo porque uma gravação em andamento é um
   arquivo sendo produzido — interrompê-la perde trabalho. Uma prévia não produz
   nada e é um clique para recomeçar; fazer o usuário achar o botão de parar
   antes de poder salvar seria cobrar por nada. */
function settleTimeline() {
  if (isTimelinePreviewing()) stopTimelinePreview();
}

/* ---------------- o diálogo ----------------
   Construído uma vez e reusado. Ele vive dentro de `root` (e não no `document`)
   pela mesma razão que todo o resto do estúdio: `unmountStudio()` solta a
   subárvore inteira, e um diálogo pendurado fora dela sobreviveria à troca de
   rota — um modal do estúdio flutuando sobre outra tela do Ankaa. */
interface DialogButton {
  label: string;
  /** o botão verde. Um por diálogo. */
  primary?: boolean;
  /** vermelho — para o que apaga */
  danger?: boolean;
  value: string;
}

let dialogEl: HTMLElement | null = null;
let dialogResolve: ((v: string | null) => void) | null = null;
let lastFocus: HTMLElement | null = null;

function ensureDialog(): HTMLElement {
  if (dialogEl) return dialogEl;
  const wrap = el('div', 'ts-proj-scrim hidden');
  wrap.setAttribute('role', 'presentation');
  const card = el('div', 'ts-proj-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  wrap.appendChild(card);

  /* Clicar no escurecido fecha, e clicar no CARD não — sem o segundo teste, um
     arrasto que comece dentro e termine fora fecharia o diálogo no meio de uma
     seleção de texto. */
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target === wrap) closeDialog(null);
  });
  root.appendChild(wrap);
  dialogEl = wrap;
  return wrap;
}

function closeDialog(value: string | null) {
  if (!dialogEl || dialogEl.classList.contains('hidden')) return;
  dialogEl.classList.add('hidden');
  const done = dialogResolve;
  dialogResolve = null;
  /* O FOCO VOLTA PARA O BOTÃO QUE ABRIU. Sem isto, fechar um diálogo devolve o
     foco ao `<body>` e a próxima tecla do usuário não vai a lugar nenhum — o
     defeito clássico de acessibilidade de modal, e o mais fácil de evitar. */
  lastFocus?.focus();
  lastFocus = null;
  done?.(value);
}

/* Esc fecha. No `root` e não no `document`: o estúdio não tem por que ouvir a
   tecla do app inteiro, e a captura é feita na fase de captura para o modal do
   editor de plotagem não engolir o evento antes. */
function bindDialogKeys() {
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!dialogEl || dialogEl.classList.contains('hidden')) return;
    if (e.key === 'Escape') { e.stopPropagation(); closeDialog(null); return; }
    if (e.key !== 'Tab') return;
    /* PRISÃO DE FOCO. Um modal de que se sai com Tab é um modal só de aparência:
       o leitor de tela continua andando pela interface atrás dele, que está
       inerte. */
    const items = Array.from(
      dialogEl.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]'),
    ).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    const active = root.querySelector<HTMLElement>(':focus');
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }, true);
}

interface DialogSpec {
  title: string;
  /** Corpo já montado. Quem passa é quem sabe o que o diálogo mostra. */
  body: HTMLElement;
  buttons: DialogButton[];
  /** O que focar ao abrir. Sem isto, o primeiro botão. */
  focus?: HTMLElement;
}

/** Abre o diálogo e resolve com o `value` do botão apertado, ou `null`. */
function openDialog(spec: DialogSpec): Promise<string | null> {
  const wrap = ensureDialog();
  const card = wrap.firstElementChild as HTMLElement;
  card.textContent = '';

  const titleId = 'ts-proj-title';
  const head = el('h2', 'ts-proj-title', spec.title);
  head.id = titleId;
  card.setAttribute('aria-labelledby', titleId);
  card.appendChild(head);
  card.appendChild(spec.body);

  const foot = el('div', 'ts-proj-foot');
  for (const b of spec.buttons) {
    const btn = el('button', 'ts-proj-btn'
      + (b.primary ? ' is-primary' : '') + (b.danger ? ' is-danger' : ''), b.label);
    btn.type = 'button';
    btn.addEventListener('click', () => closeDialog(b.value));
    foot.appendChild(btn);
  }
  card.appendChild(foot);

  lastFocus = root.querySelector<HTMLElement>(':focus') ?? $('btn-project');
  wrap.classList.remove('hidden');
  (spec.focus ?? foot.querySelector<HTMLElement>('.is-primary') ?? foot.firstElementChild as HTMLElement)
    ?.focus();

  return new Promise((resolve) => { dialogResolve = resolve; });
}

/** Um diálogo de sim/não. Devolve `true` só no botão de confirmar. */
async function confirmDialog(
  title: string, lines: string[], confirmLabel: string, danger = false,
): Promise<boolean> {
  const body = el('div', 'ts-proj-body');
  for (const t of lines) body.appendChild(el('p', 'ts-proj-p', t));
  const v = await openDialog({
    title,
    body,
    buttons: [
      { label: 'Cancelar', value: 'no' },
      { label: confirmLabel, value: 'yes', primary: !danger, danger },
    ],
  });
  return v === 'yes';
}

/* ---------------- a lista de problemas ----------------
   O que `verifyProject()` achou, mostrado ANTES de a cena mudar. É a metade
   honesta da promessa de "igual em outro PC": o que este catálogo não tem, dito
   enquanto ainda dá para desistir. */
async function confirmProblems(problems: ProjectProblem[], what: string): Promise<boolean> {
  if (!problems.length) return true;
  const errors = problems.filter((p) => p.level === 'erro');
  const body = el('div', 'ts-proj-body');
  body.appendChild(el('p', 'ts-proj-p', errors.length
    ? 'Este projeto cita coisas que não existem neste catálogo. O que faltar não vai aparecer na cena.'
    : 'Este projeto abre, mas algumas peças mudaram de nome desde que ele foi salvo.'));
  const list = el('ul', 'ts-proj-problems');
  for (const p of problems) {
    const li = el('li', `ts-proj-problem is-${p.level}`, p.text);
    list.appendChild(li);
  }
  body.appendChild(list);
  const v = await openDialog({
    title: `${what}: conferência`,
    body,
    buttons: [
      { label: 'Cancelar', value: 'no' },
      { label: 'Abrir mesmo assim', value: 'yes', primary: true },
    ],
  });
  return v === 'yes';
}

/* ---------------- salvar ---------------- */

/** Nome sugerido quando o projeto ainda não tem um. */
function suggestName(doc: StudioProject): string {
  const L = doc.labels ?? {};
  return [L.model, L.color].filter(Boolean).join(' · ') || 'Projeto sem nome';
}

/**
 * Lê a cena e monta o documento, com miniatura.
 *
 * A MINIATURA PASSA PELO CADEADO DE CAPTURA de ui/chrome.ts. Sem isso ela
 * poderia renderizar no meio de uma gravação e congelar o vídeo — ver
 * `claimCapture()` lá. Um cadeado ocupado não cancela o salvamento: o projeto é
 * gravado sem imagem nova, que é a perda certa a aceitar.
 */
async function buildDocument(name?: string): Promise<{ doc: StudioProject; thumb: Blob | null }> {
  const doc = captureProject(name);
  const release = claimCapture();
  if (!release) return { doc, thumb: null };
  try { return { doc, thumb: await captureThumbnail() }; }
  finally { release(); }
}

async function doSave() {
  if (!store.canStore()) {
    await confirmDialog(
      'Biblioteca indisponível',
      ['Este navegador não permite guardar projetos (janela privada ou política do sistema).',
        'Use "Exportar" para gerar um arquivo .' + PROJECT_EXT + ' e guardá-lo você mesmo.'],
      'Entendi',
    );
    return;
  }

  const doc = captureProject();
  const body = el('div', 'ts-proj-body');
  body.appendChild(el('p', 'ts-proj-p',
    'O projeto fica guardado neste navegador. Para levá-lo a outro computador, use "Exportar".'));
  const label = el('label', 'ts-proj-field');
  label.appendChild(el('span', 'ts-proj-label', 'Nome do projeto'));
  const input = el('input', 'ts-proj-input');
  input.type = 'text';
  input.value = openName || suggestName(doc);
  input.maxLength = 80;
  label.appendChild(input);
  body.appendChild(label);

  /* Enter no campo confirma. É o que qualquer um tenta primeiro, e sem isto o
     Enter submeteria um formulário que não existe — ou seja, não faria nada. */
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); closeDialog('save'); }
  });

  const buttons: DialogButton[] = [{ label: 'Cancelar', value: 'no' }];
  /* "Salvar cópia" só aparece com um projeto ABERTO — sem um, ele não teria de
     que fazer cópia, e um botão que não pode significar nada é ruído. */
  if (openId) buttons.push({ label: 'Salvar cópia', value: 'copy' });
  buttons.push({ label: openId ? 'Salvar' : 'Criar', value: 'save', primary: true });

  const choice = await openDialog({ title: 'Salvar projeto', body, buttons, focus: input });
  if (choice !== 'save' && choice !== 'copy') return;

  const name = input.value.trim() || suggestName(doc);
  await withPill('Salvando o projeto…', async () => {
    try {
      const built = await buildDocument(name);
      const meta = await store.saveProject(built.doc, name, {
        id: choice === 'copy' ? undefined : openId ?? undefined,
        thumb: built.thumb,
      });
      openId = meta.id;
      openName = meta.name;
      setStatus(`Projeto "${name}" salvo na biblioteca deste navegador.`);
    } catch (err) {
      console.error('[truck-studio] salvar projeto', err);
      setStatus('Não foi possível salvar o projeto: ' + errText(err));
    }
  });
}

/* ---------------- abrir ---------------- */

const dateText = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/* As object URLs das miniaturas vivem enquanto a lista está na tela e são
   revogadas ao fechar. Sem isso, abrir o diálogo dez vezes vaza dez conjuntos de
   blobs pelo resto da sessão. */
let thumbUrls: string[] = [];
function releaseThumbs() {
  for (const u of thumbUrls) URL.revokeObjectURL(u);
  thumbUrls = [];
}

async function doOpen() {
  let rows: store.ProjectMeta[] = [];
  try { rows = await store.listProjects(); }
  catch (err) {
    setStatus('Não foi possível ler a biblioteca: ' + errText(err));
    return;
  }

  const body = el('div', 'ts-proj-body');
  if (!rows.length) {
    body.appendChild(el('p', 'ts-proj-p',
      'Nenhum projeto salvo ainda neste navegador. Use "Salvar" para guardar o que está na tela, '
      + 'ou "Importar" para abrir um arquivo .' + PROJECT_EXT + ' que alguém tenha mandado.'));
    await openDialog({ title: 'Abrir projeto', body, buttons: [{ label: 'Fechar', value: 'no', primary: true }] });
    return;
  }

  const list = el('div', 'ts-proj-list');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Projetos salvos');

  let picked: string | null = null;

  for (const row of rows) {
    const item = el('button', 'ts-proj-item' + (row.id === openId ? ' is-open' : ''));
    item.type = 'button';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', 'false');

    const media = el('span', 'ts-proj-thumb');
    if (row.thumb) {
      const url = URL.createObjectURL(row.thumb);
      thumbUrls.push(url);
      const img = el('img');
      img.src = url;
      img.alt = '';
      media.appendChild(img);
    } else {
      /* Sem miniatura, as INICIAIS — a mesma degradação do crachá do seletor e
         da cortina. Um ícone de imagem quebrada não identifica nada. */
      media.classList.add('is-empty');
      media.textContent = (row.model ?? row.name).slice(0, 2).toUpperCase();
    }
    item.appendChild(media);

    const text = el('span', 'ts-proj-itembody');
    text.appendChild(el('span', 'ts-proj-name', row.name));
    const sub = [row.model, row.color, row.environment].filter(Boolean).join(' · ');
    if (sub) text.appendChild(el('span', 'ts-proj-sub', sub));
    text.appendChild(el('span', 'ts-proj-meta',
      `${dateText(row.savedAt)} · ${store.formatBytes(row.bytes)}`));
    item.appendChild(text);

    /* APAGAR é um botão DENTRO da linha, e por isso o `stopPropagation`: sem
       ele, o clique borbulha para a linha e o projeto que se queria apagar
       seria aberto no mesmo gesto. */
    const del = el('span', 'ts-proj-del');
    del.setAttribute('role', 'button');
    del.setAttribute('tabindex', '0');
    del.title = `Apagar "${row.name}"`;
    del.setAttribute('aria-label', `Apagar o projeto ${row.name}`);
    del.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"'
      + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
      + ' focusable="false" aria-hidden="true"><path d="M4.6 6.6h14.8M9.4 6.6V4.8h5.2v1.8'
      + 'M6.6 6.6l.9 12a1.4 1.4 0 0 0 1.4 1.3h6.2a1.4 1.4 0 0 0 1.4-1.3l.9-12"/></svg>';
    const remove = async (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      closeDialog(null);
      const yes = await confirmDialog(
        'Apagar projeto',
        [`"${row.name}" será apagado deste navegador. Isto não pode ser desfeito.`,
          'Um arquivo .' + PROJECT_EXT + ' já exportado não é afetado.'],
        'Apagar', true,
      );
      if (yes) {
        try {
          await store.deleteProject(row.id);
          if (openId === row.id) { openId = null; openName = ''; }
          setStatus(`Projeto "${row.name}" apagado.`);
        } catch (err) {
          setStatus('Não foi possível apagar: ' + errText(err));
        }
      }
      void doOpen();
    };
    del.addEventListener('click', remove);
    del.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') void remove(e);
    });
    item.appendChild(del);

    item.addEventListener('click', () => { picked = row.id; closeDialog('open'); });
    list.appendChild(item);
  }

  body.appendChild(list);
  const answer = await openDialog({
    title: 'Abrir projeto',
    body,
    buttons: [{ label: 'Fechar', value: 'no' }],
    focus: list.querySelector<HTMLElement>('.ts-proj-item') ?? undefined,
  });
  releaseThumbs();
  if (answer !== 'open' || !picked) return;

  const doc = await store.loadProject(picked);
  if (!doc) { setStatus('Este projeto não pôde ser lido da biblioteca.'); return; }

  if (!await confirmDestructive('Abrir projeto')) return;
  if (!await confirmProblems(verifyProject(doc), 'Abrir projeto')) return;

  const meta = await store.getMeta(picked);
  await runApply(doc, () => {
    openId = picked;
    openName = meta?.name ?? doc.name ?? '';
    setStatus(`Projeto "${openName}" aberto.`);
  });
}

/* ---------------- exportar / importar ---------------- */

async function doExport() {
  if (isCanvasBusy()) {
    setStatus('Espere a captura ou a gravação terminar para exportar.');
    return;
  }
  const pill = claimPill('Gerando o arquivo do projeto…');
  try {
    const built = await buildDocument(openName || undefined);
    const blob = await writeProjectFile(built.doc, { preview: built.thumb });
    const filename = projectFilename(built.doc);
    downloadFile(blob, filename);
    setStatus(`Projeto exportado: ${filename} · ${store.formatBytes(blob.size)}`);
  } catch (err) {
    console.error('[truck-studio] exportar projeto', err);
    setStatus('Não foi possível exportar o projeto: ' + errText(err));
  } finally {
    pill.release();
  }
}

/* O `<input type=file>` é criado uma vez e reusado. Ele fica dentro de `root`
   (e não solto no `document`) pelo mesmo motivo do diálogo, e `value` é limpo
   ANTES de cada uso: sem isso, escolher o MESMO arquivo duas vezes seguidas não
   dispara `change` na segunda, e o botão parece morto. */
let fileInput: HTMLInputElement | null = null;

function ensureFileInput(): HTMLInputElement {
  if (fileInput) return fileInput;
  const input = el('input', 'ts-proj-file');
  input.type = 'file';
  /* Os dois: a extensão para quem tem o arquivo com o nome certo, e o mime para
     um download que tenha chegado com o nome trocado por algum provedor. */
  input.accept = `.${PROJECT_EXT},application/zip`;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void importFile(file);
  });
  root.appendChild(input);
  fileInput = input;
  return input;
}

/* UM indicador, não dois.
   ---------------------------------------------------------------------------
   Relato: *"aparecem 2 loadings — primeiro um lendo arquivo no topo, depois o
   loading com a barra de progresso, que é o único que eu quero"*. Ele estava
   certo: a leitura do ZIP usava a PÍLULA e a montagem usava a CORTINA, então o
   usuário via um aviso discreto, ele sumir, e outra coisa tomar a tela.

   Ler um `.ankaastudio` com dezenas de megabytes de logo não é instantâneo, e é
   a MESMA operação, do ponto de vista de quem clicou: "abrir este arquivo". Vira
   a primeira fatia da mesma barra — 0 a 15 %, antes de o `applyProject()` assumir
   em 15 e seguir até o fim. A pílula sai. */
async function importFile(file: File) {
  /* A PERGUNTA DESTRUTIVA VEM ANTES DE QUALQUER CORTINA.
     Relato: *"2 loadings meio que remontados"* — e a foto mostra o diálogo
     "Substituir?" flutuando sobre uma cortina que já dizia "Montando a cena".
     Perguntar por cima de um indicador de progresso é dizer duas coisas
     contraditórias ao mesmo tempo: "estou trabalhando" e "não vou fazer nada até
     você responder".
     Esta confirmação NÃO precisa do arquivo — ela só conta o que está na tela —,
     então ela cabe aqui, antes de tudo. Quem cancela nunca vê cortina nenhuma. */
  if (!await confirmDestructive('Importar projeto')) return;

  showCurtain('Lendo o arquivo do projeto…');
  setCurtainProgress(0.04, 'Lendo o arquivo do projeto…');
  let doc: StudioProject;
  let problems: string[];
  try {
    const read = await readProjectFile(file);
    doc = read.doc;
    problems = read.problems;
    setCurtainProgress(0.15, 'Conferindo o projeto…');
  } catch (err) {
    /* A cortina TEM de sair antes do diálogo: ela é z-index 400 e o diálogo
       10000, então ele apareceria por cima de uma cortina viva — e se o usuário
       desistisse, ela ficaria de pé sobre uma cena que ninguém vai montar. */
    await finishCurtain();
    const message = err instanceof ProjectFileError
      ? err.message
      : 'Não foi possível ler este arquivo: ' + errText(err);
    if (!(err instanceof ProjectFileError)) console.error('[truck-studio] importar projeto', err);
    await confirmDialog('Importar projeto', [message], 'Entendi');
    return;
  }

  /* Os problemas de INTEGRIDADE (imagem faltando ou corrompida) e os de
     COMPATIBILIDADE (id que este catálogo não tem) chegam por caminhos
     diferentes e são mostrados na MESMA lista: para quem está olhando, os dois
     respondem à mesma pergunta — "o que deste arquivo eu não vou ver?". */
  const all: ProjectProblem[] = [
    ...problems.map((text): ProjectProblem => ({ level: 'aviso', text })),
    ...verifyProject(doc),
  ];

  /* AS PERGUNTAS ACONTECEM COM A CORTINA DE PÉ, e o diálogo (z 10000) fica
     sobre ela (z 400) — é a mesma leitura de "estou trabalhando, e preciso de
     uma resposta para continuar". O que NÃO pode acontecer é uma desistência
     deixar a cortina pendurada sobre uma cena que ninguém vai montar, então as
     duas saídas a derrubam. Quando o usuário confirma, a cortina é entregue de
     pé para `applyProject()`, que a segura até o fim e a desce no `finally`. */
  /* A LISTA DE PROBLEMAS, quando existe, é a exceção — e ela também não pode ser
     lida por cima de uma barra andando. Aqui a cortina DESCE para perguntar e
     `applyProject()` a levanta de novo se o usuário seguir. No caminho comum
     (nenhum problema) nada disto roda e a cortina atravessa inteira, que é o
     que foi pedido: um loading só. */
  if (all.length) {
    await finishCurtain();
    if (!await confirmProblems(all, 'Importar projeto')) return;
  }

  await runApply(doc, () => {
    /* SEM id: um projeto importado ainda não é da biblioteca desta máquina. O
       nome viaja para o campo de Salvar já preenchido, que é o atalho para
       adotá-lo. Ver o bloco "o projeto ABERTO" lá em cima. */
    openId = null;
    openName = doc.name ?? '';
    setStatus(`Projeto importado de ${file.name}.`);
  });
}

/* ---------------- novo ---------------- */

/** "3 objetos" / "1 objeto" — o plural é do português, não do inglês. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function doNew() {
  const art = artworkCount();
  const keys = timelineCount();
  /* As duas coisas AUTORAIS são listadas em separado e só quando existem: um
     aviso que diz "0 objetos serão apagados" ensina a fechar avisos sem ler. */
  const losing = [
    art ? `a arte dos painéis (${plural(art, 'objeto', 'objetos')})` : null,
    keys ? `o percurso de câmera (${plural(keys, 'ponto', 'pontos')})` : null,
  ].filter(Boolean) as string[];

  const yes = await confirmDialog(
    'Novo projeto',
    [
      losing.length
        ? `Será apagado: ${losing.join(' e ')}.`
        : 'Nada desenhado será perdido — os painéis já estão vazios.',
      'Também voltam ao padrão: a iluminação, as medidas e portas do baú, '
      + 'os acabamentos, o ajuste da tinta e a vista.',
      'Em seguida o seletor reabre desde o cenário, para escolher o caminhão '
      + 'do projeto novo.',
    ],
    'Começar do zero', true,
  );
  if (!yes) return;

  /* A PÍLULA COBRE SÓ A ZERAGEM. `newProject()` termina abrindo o seletor, que
     é um overlay de tela inteira e passa a ser o indicador dali em diante — uma
     pílula ainda de pé flutuaria sobre os cards dizendo "recomeçando" enquanto o
     usuário já está escolhendo. `onWiped` é o instante exato entre as duas
     coisas, e por isso ele existe: sem ele daria para soltar a pílula cedo
     demais (a zeragem tem um recorte de baú de ~3 s) ou tarde demais. */
  openId = null;
  openName = '';
  const pill = claimPill('Recomeçando…');
  let released = false;
  const release = () => { if (!released) { released = true; pill.release(); } };
  try {
    await newProject({ onWiped: release });
  } catch (err) {
    console.error('[truck-studio] novo projeto', err);
    setStatus('Não foi possível recomeçar: ' + errText(err));
  } finally {
    /* Uma zeragem que lance antes do `onWiped` não pode deixar a pílula presa. */
    release();
  }
}

/* ---------------- o comum das três destrutivas ---------------- */

/** Confirma a perda do que está na tela. `true` quando não há nada a perder. */
async function confirmDestructive(what: string): Promise<boolean> {
  const art = artworkCount();
  const keys = timelineCount();
  if (!art && !keys) return true;
  const has = [
    art ? `${plural(art, 'objeto desenhado', 'objetos desenhados')} nos painéis` : null,
    keys ? `${plural(keys, 'ponto', 'pontos')} de câmera` : null,
  ].filter(Boolean) as string[];
  return confirmDialog(
    what,
    [`Há ${has.join(' e ')} na tela.`,
      'Abrir outro projeto substitui tudo isso.'],
    'Substituir', true,
  );
}

/** Aplica um documento sob a pílula, com o erro indo para a linha de estado. */
/* SEM PÍLULA AQUI. `applyProject()` levanta a CORTINA e a segura até a última
   etapa — medidas, plotagem, tinta, luz —, que é o que o relato pediu: *"deveria
   mostrar um loading até tudo estar correto"*. Uma pílula discreta por cima dela
   seria um segundo indicador dizendo a mesma coisa, e o mais fraco dos dois. */
async function runApply(doc: StudioProject, onDone: () => void) {
  try {
    await applyProject(doc);
    onDone();
  } catch (err) {
    console.error('[truck-studio] aplicar projeto', err);
    setStatus('O projeto foi lido, mas não pôde ser montado: ' + errText(err));
  }
}

/* ---------------- o menu ---------------- */

interface MenuAction {
  id: string;
  label: string;
  hint: string;
  icon: string;
  run: () => void | Promise<void>;
  /** separa este item do anterior com um filete */
  group?: boolean;
}

/* Os ícones, no mesmo dialeto do resto da chrome: SVG 24×24, traço 1.7 em
   `currentColor`, sem preenchimento. Nunca emoji — a plataforma escolheria a
   fonte, e o glifo não seguiria a cor. */
const ICON = {
  novo: '<path d="M12 5.4v13.2M5.4 12h13.2"/>',
  salvar: '<path d="M5.4 4.6h9.6l4 4v10.8a1 1 0 0 1-1 1H5.4a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1Z"/>'
    + '<path d="M8 4.6v5h6v-5M8 19.4v-5.2h8v5.2"/>',
  abrir: '<path d="M3.4 7.4a1.6 1.6 0 0 1 1.6-1.6h4l1.9 2.2h7.5a1.6 1.6 0 0 1 1.6 1.6v8.4'
    + 'a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6Z"/>',
  exportar: '<path d="M12 15.2V4.4M8.4 7.8 12 4.2l3.6 3.6"/>'
    + '<path d="M4.6 14v4.4a1.4 1.4 0 0 0 1.4 1.4h12a1.4 1.4 0 0 0 1.4-1.4V14"/>',
  importar: '<path d="M12 4.2v10.8M8.4 11.4 12 15l3.6-3.6"/>'
    + '<path d="M4.6 14v4.4a1.4 1.4 0 0 0 1.4 1.4h12a1.4 1.4 0 0 0 1.4-1.4V14"/>',
};

const svg = (paths: string) =>
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"'
  + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
  + ` focusable="false" aria-hidden="true">${paths}</svg>`;

/* A ORDEM: o que zera, o que guarda aqui, o que atravessa máquina. Os filetes
   marcam essas três naturezas, e são eles que respondem "por que Exportar não é
   a mesma coisa que Salvar?" sem ninguém ter de ler nada. */
const ACTIONS: MenuAction[] = [
  {
    id: 'novo', label: 'Novo', icon: ICON.novo,
    hint: 'Zera tudo e escolhe cenário e caminhão de novo',
    run: doNew,
  },
  {
    id: 'salvar', label: 'Salvar', icon: ICON.salvar, group: true,
    hint: 'Guarda na biblioteca deste navegador',
    run: doSave,
  },
  {
    id: 'abrir', label: 'Abrir', icon: ICON.abrir,
    hint: 'Lista os projetos salvos aqui',
    run: doOpen,
  },
  {
    id: 'exportar', label: 'Exportar', icon: ICON.exportar, group: true,
    hint: `Gera um .${PROJECT_EXT} para mandar a outra pessoa`,
    run: doExport,
  },
  {
    id: 'importar', label: 'Importar', icon: ICON.importar,
    hint: `Abre um .${PROJECT_EXT} recebido`,
    run: () => { ensureFileInput().click(); },
  },
];

function paintMenu(menuEl: HTMLElement): HTMLButtonElement[] {
  menuEl.textContent = '';
  const items: HTMLButtonElement[] = [];

  const head = el('div', 'ts-shotmenu__head', openName ? `Projeto · ${openName}` : 'Projeto');
  head.setAttribute('aria-hidden', 'true');
  menuEl.appendChild(head);

  for (const a of ACTIONS) {
    const item = el('button', 'ts-projitem' + (a.group ? ' is-grouped' : ''));
    item.type = 'button';
    /* `menuitem` e não `radio`: cada linha AGE. É o oposto do menu de captura,
       onde as linhas escolhem e um botão separado age — e é por isso que este
       painel não tem o botão verde daquele. */
    item.setAttribute('role', 'menuitem');
    item.dataset.act = a.id;

    const ico = el('span', 'ts-projitem__ico');
    ico.setAttribute('aria-hidden', 'true');
    ico.innerHTML = svg(a.icon);
    item.appendChild(ico);

    const text = el('span', 'ts-projitem__body');
    text.appendChild(el('span', 'ts-projitem__name', a.label));
    text.appendChild(el('span', 'ts-projitem__hint', a.hint));
    item.appendChild(text);

    item.setAttribute('aria-label', `${a.label} — ${a.hint}`);
    item.addEventListener('click', () => {
      /* FECHA ANTES DE AGIR, e as quatro das cinco ações abrem um diálogo: um
         menu aberto atrás de um modal fica visível pela borda e recebe o clique
         que era do escurecido. A quinta (Exportar) não abre nada, e fechar
         também é o certo — ela já terminou de perguntar. */
      pop?.close();
      settleTimeline();
      void a.run();
    });
    menuEl.appendChild(item);
    items.push(item);
  }
  return items;
}

/* ---------------- init ---------------- */

/**
 * Monta o menu de projeto no botão da régua.
 *
 * CHAMADO POR studio.ts, E NÃO POR `initUI()`. Este módulo importa `setStatus`,
 * `makePopover` e o cadeado de captura de ui/chrome; se chrome chamasse daqui,
 * fecharia um ciclo de import. É exatamente a mesma decisão — e o mesmo
 * comentário — que já vale para `ui/paint-panel.ts`: o motor carrega UM ciclo de
 * propósito (livery ↔ livery-editor) e um é o suficiente.
 *
 * A ordem em relação aos outros dois menus não importa: `makePopover` troca o
 * botão pelo invólucro com `replaceWith`, que preserva a posição na régua.
 */
export function initProjectPanel() {
  bindDialogKeys();
  pop = makePopover({
    trigger: $<HTMLButtonElement>('btn-project'),
    id: 'ts-projmenu',
    groupClass: 'ts-shotgroup--proj',
    ariaLabel: 'Projeto',
    paint: paintMenu,
  });
}
