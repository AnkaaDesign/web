/* A interface do editor de pintura: o modal, a barra, o inspetor contextual, a
   lista de camadas e o mapa do teclado.

   Tudo aqui passa por ../vehicle/livery-doc.ts — nada neste arquivo sabe como
   uma propriedade é serializada, medida ou desfeita.

   ATENÇÃO ao ciclo de importação com ../vehicle/livery.ts: aquele módulo importa
   initLiveryEditor() daqui, e este importa as telas de lá. O corpo DESTE módulo
   não pode tocar em nada de livery.ts durante a avaliação — só dentro de
   funções. É por isso que os elementos abaixo vêm de core/dom (já avaliado) e
   não há nenhuma chamada de topo. */
import * as fabric from 'fabric';
import { $, $$, evTarget, isMounted } from '../core/dom';
import {
  surfaces, SURFACE_KEYS, active, activeKey, setActiveKey, otherSide,
  CAPTIONS, DEFAULT_BG, markDirty, sizeModalCanvas, stagePanels,
  pxToCm, cmToPx, panelMM, mmPerPx,
} from '../vehicle/livery';
import type { SurfaceKey } from '../vehicle/livery';
import {
  FONTS, DEFAULT_FONT, ensureFont, fontLoaded, isText, isImage, stamp, assetOf,
  addImageFile, normalizeTextScale, applyLockState, history, isRestoring, EXTRA,
  align, distribute, withSelectionFlattened, restoreSelection,
  copySurface, sidesMatch, restorePersisted, bindPersistFlush,
} from '../vehicle/livery-doc';
import { initSnapping, setSnapEnabled, drawRulers, resizeSnapLayers } from './livery-guides';

type AnyObj = fabric.FabricObject & {
  id?: string | null; name?: string; locked?: boolean; assetId?: string; renamed?: boolean;
};

const modal = () => $('editor-modal');
const isOpen = () => !modal().classList.contains('hidden');
const cm1 = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

let alignFrame: 'selection' | 'outline' = 'selection';
let zoom: string = 'fit';
let syncing = false;                       // impede que o inspetor ecoe a própria escrita
let clipboard: Record<string, unknown>[] | null = null;

const zoomFactor = () => (zoom === 'fit' ? 1 : parseFloat(zoom) || 1);
const resize = () => { sizeModalCanvas(activeKey(), zoomFactor()); drawRulers(); };

const selObjects = () => active().getActiveObjects();

function selMode(objs: fabric.FabricObject[]): 'none' | 'text' | 'image' | 'multi' {
  if (!objs.length) return 'none';
  if (objs.length > 1) return 'multi';
  return isText(objs[0]) ? 'text' : isImage(objs[0]) ? 'image' : 'multi';
}

function syncPanels(objs: fabric.FabricObject[]) {
  const tokens = new Set<string>([selMode(objs)]);
  if (objs.length && objs.every(isText)) tokens.add('text');
  for (const p of $$('#inspector .insp')) {
    const list = (p.dataset.for || '').split(' ');
    p.classList.toggle('hidden', !(list.includes('always') || list.some((t) => tokens.has(t))));
  }
}

/* ---------------- tipografia ---------------- */
function applyToText(fn: (o: fabric.IText) => void, commit = true) {
  const c = active(), key = activeKey();
  const objs = c.getActiveObjects().filter(isText) as fabric.IText[];
  if (!objs.length) return;
  for (const o of objs) {
    fn(o);
    o.initDimensions(); o.setCoords(); o.set('dirty', true);
  }
  markDirty(key); c.requestRenderAll();
  if (commit) history.push(key);
}

function applyToAny(fn: (o: fabric.FabricObject) => void, commit = true) {
  const c = active(), key = activeKey();
  const objs = c.getActiveObjects();
  if (!objs.length) return;
  for (const o of objs) { fn(o); o.setCoords(); o.set('dirty', true); }
  markDirty(key); c.requestRenderAll();
  if (commit) history.push(key);
}

function buildFontMenu() {
  const menu = $('font-menu');
  menu.innerHTML = '';
  for (const f of FONTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-opt' + (fontLoaded(f.family) ? '' : ' loading');
    b.dataset.family = f.family;
    b.innerHTML = `<b style="font-family:'${f.family}'">Sua marca</b><em>${f.family} · ${f.note}</em>`;
    b.addEventListener('click', async () => {
      await setFontFamily(f.family);
      menu.classList.add('hidden');
    });
    menu.appendChild(b);
  }
  // uma prévia em fonte substituta não serve para nada, então puxa todas de uma vez
  void Promise.all(FONTS.map((f) => ensureFont(f.family))).then(() => {
    for (const el of $$('#font-menu .font-opt')) el.classList.remove('loading');
  });
}

async function setFontFamily(family: string) {
  await ensureFont(family);                            // TEM de vir antes do set,
  applyToText((o) => o.set('fontFamily', family));     // senão o fabric guarda as métricas da substituta
  syncInspector();
}

function bindTypography() {
  buildFontMenu();

  $('font-trigger').addEventListener('click', (e) => {
    e.stopPropagation();
    $('font-menu').classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement)?.closest?.('.font-picker')) $('font-menu').classList.add('hidden');
  });

  $('t-size').addEventListener('change', (e) => {
    const cm = parseFloat(evTarget<HTMLInputElement>(e).value);
    if (!(cm > 0)) return;
    applyToText((o) => o.set('fontSize', cmToPx(cm, activeKey())));
  });

  $('t-weight').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.seg-btn');
    if (!b) return;
    applyToText((o) => o.set('fontWeight', Number(b.dataset.w)));
    syncInspector();
  });
  $('t-align').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.seg-btn');
    if (!b) return;
    applyToText((o) => o.set('textAlign', b.dataset.a as string));
    syncInspector();
  });

  const track = $<HTMLInputElement>('t-tracking');
  track.addEventListener('input', () => {
    $('t-tracking-val').textContent = (Number(track.value) / 10).toFixed(1) + ' %';
    applyToText((o) => o.set('charSpacing', Number(track.value)), false);
  });
  track.addEventListener('change', () => history.push(activeKey()));

  const lead = $<HTMLInputElement>('t-leading');
  lead.addEventListener('input', () => {
    $('t-leading-val').textContent = (Number(lead.value) / 100).toFixed(2).replace('.', ',');
    applyToText((o) => o.set('lineHeight', Number(lead.value) / 100), false);
  });
  lead.addEventListener('change', () => history.push(activeKey()));

  $('t-fill').addEventListener('input', (e) => {
    const v = evTarget<HTMLInputElement>(e).value;
    applyToText((o) => o.set('fill', v), false);
  });
  $('t-fill').addEventListener('change', () => history.push(activeKey()));

  $('t-stroke').addEventListener('input', (e) => {
    const v = evTarget<HTMLInputElement>(e).value;
    applyToText((o) => o.set('stroke', v), false);
  });
  $('t-stroke').addEventListener('change', () => history.push(activeKey()));

  $('t-stroke-w').addEventListener('change', (e) => {
    const cm = Math.max(0, parseFloat(evTarget<HTMLInputElement>(e).value) || 0);
    applyToText((o) => o.set({
      strokeWidth: cmToPx(cm, activeKey()),
      // contorno por cima do preenchimento come as letras finas por dentro:
      // pintar o traço PRIMEIRO é o que dá o contorno que se espera
      paintFirst: 'stroke',
      strokeUniform: true,
    }));
  });

  // presets em centímetros, que é a unidade em que uma pintura é encomendada
  const presets = $('t-size-presets');
  for (const cm of [10, 20, 30, 40, 60]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = cm + ' cm';
    b.addEventListener('click', () => applyToText((o) => o.set('fontSize', cmToPx(cm, activeKey()))));
    presets.appendChild(b);
  }
}

/* ---------------- transformar ---------------- */
function bindTransform() {
  const firstRect = () => selObjects()[0]?.getBoundingRect();

  $('tf-x').addEventListener('change', (e) => {
    const r = firstRect(); if (!r) return;
    const d = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'x') - r.left;
    applyToAny((o) => o.setXY(o.getXY().add(new fabric.Point(d, 0))));
    syncInspector();
  });
  $('tf-y').addEventListener('change', (e) => {
    const r = firstRect(); if (!r) return;
    const d = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'y') - r.top;
    applyToAny((o) => o.setXY(o.getXY().add(new fabric.Point(0, d))));
    syncInspector();
  });
  $('tf-w').addEventListener('change', (e) => {
    const r = firstRect(); if (!r?.width) return;
    const target = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'x');
    if (!(target > 0)) return;
    const f = target / r.width;
    applyToAny((o) => o.set({ scaleX: o.scaleX * f, scaleY: o.scaleY * f }));
    syncInspector();
  });
  $('tf-h').addEventListener('change', (e) => {
    const r = firstRect(); if (!r?.height) return;
    const target = cmToPx(Number(evTarget<HTMLInputElement>(e).value), activeKey(), 'y');
    if (!(target > 0)) return;
    const f = target / r.height;
    applyToAny((o) => o.set({ scaleX: o.scaleX * f, scaleY: o.scaleY * f }));
    syncInspector();
  });

  const rot = $<HTMLInputElement>('tf-rot');
  rot.addEventListener('input', () => {
    $('tf-rot-val').textContent = rot.value + '°';
    applyToAny((o) => o.rotate(Number(rot.value)), false);
  });
  rot.addEventListener('change', () => history.push(activeKey()));
  $('tf-rot-presets').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!b) return;
    applyToAny((o) => o.rotate(Number(b.dataset.deg)));
    syncInspector();
  });

  $('flip-x').addEventListener('click', () => applyToAny((o) => o.set('flipX', !o.flipX)));
  $('flip-y').addEventListener('click', () => applyToAny((o) => o.set('flipY', !o.flipY)));
}

/* ---------------- imagem ---------------- */
function bindImage() {
  const op = $<HTMLInputElement>('i-opacity');
  op.addEventListener('input', () => {
    $('i-opacity-val').textContent = op.value + ' %';
    applyToAny((o) => o.set('opacity', Number(op.value) / 100), false);
  });
  op.addEventListener('change', () => history.push(activeKey()));

  $('i-reset-aspect').addEventListener('click', () => {
    applyToAny((o) => { if (isImage(o)) o.set('scaleY', o.scaleX); });
    syncInspector();
  });
}

/* ---------------- alinhar / distribuir ---------------- */
function bindAlign() {
  $('align-frame').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.seg-btn');
    if (!b) return;
    alignFrame = b.dataset.frame as 'selection' | 'outline';
    for (const x of $$('#align-frame .seg-btn')) x.classList.toggle('on', x === b);
    syncInspector();
  });

  $('align-grid').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.icon-btn');
    if (!b) return;
    /* Com um objeto só não existe caixa de seleção a que alinhar — o painel é o
       único quadro que significa alguma coisa, então ele vale independentemente
       do botão. */
    align(b.dataset.align as never, selObjects().length > 1 ? alignFrame : 'outline');
    syncInspector();
  });

  for (const b of $$('[data-dist]')) {
    b.addEventListener('click', () => { distribute(b.dataset.dist as 'x' | 'y'); syncInspector(); });
  }
  for (const b of $$('[data-gap]')) {
    b.addEventListener('click', () => {
      const cm = parseFloat($<HTMLInputElement>('gap-val').value);
      if (!(cm >= 0)) return;
      distribute(b.dataset.gap as 'x' | 'y', cm);
      syncInspector();
    });
  }
}

/* ---------------- camadas ---------------- */
function defaultName(o: fabric.FabricObject): string {
  if (isText(o)) return ((o as fabric.IText).text || '').trim().slice(0, 24) || 'Texto';
  if (isImage(o)) return assetOf((o as AnyObj).assetId)?.name || 'Imagem';
  return 'Objeto';
}

let dragSrcIndex: number | null = null;

function renderLayers() {
  const c = active(), list = $('layer-list');
  const objs = c.getObjects();
  const activeSet = new Set(c.getActiveObjects());
  $('layer-count').textContent = objs.length ? `${objs.length} ${objs.length === 1 ? 'item' : 'itens'}` : '';
  list.innerHTML = '';
  if (!objs.length) {
    list.innerHTML = '<div class="layer-empty">Nenhum objeto neste painel.</div>';
    return;
  }

  // getObjects() vem de baixo para cima; uma lista de camadas se lê de cima
  objs.slice().reverse().forEach((o, i) => {
    const idx = objs.length - 1 - i;
    const a = o as AnyObj;
    const row = document.createElement('div');
    row.className = 'layer-row' + (activeSet.has(o) ? ' on' : '') + (o.visible ? '' : ' is-hidden');
    row.draggable = true;

    const grip = document.createElement('span');
    grip.className = 'lyr-grip'; grip.textContent = '⠿';
    const icon = document.createElement('span');
    icon.className = 'lyr-icon'; icon.textContent = isText(o) ? 'T' : '▣';

    const name = document.createElement('input');
    name.className = 'lyr-name'; name.readOnly = true;
    name.value = a.name || defaultName(o);
    name.addEventListener('dblclick', () => { name.readOnly = false; name.select(); });
    name.addEventListener('blur', () => {
      name.readOnly = true;
      const v = name.value.trim();
      if (v && v !== a.name) { a.name = v; a.renamed = true; history.push(activeKey()); }
      else name.value = a.name || defaultName(o);
    });
    name.addEventListener('keydown', (ev) => {
      ev.stopPropagation();                    // Delete/setas não podem chegar à tela
      if (ev.key === 'Enter') name.blur();
    });

    const eye = document.createElement('button');
    eye.type = 'button';
    eye.className = 'lyr-btn' + (o.visible ? '' : ' on');
    eye.textContent = o.visible ? '👁' : '🚫';
    eye.title = o.visible ? 'Ocultar' : 'Mostrar';
    eye.addEventListener('click', (ev) => {
      ev.stopPropagation();
      o.set('visible', !o.visible);
      markDirty(activeKey()); c.requestRenderAll(); history.push(activeKey()); renderLayers();
    });

    const lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'lyr-btn' + (a.locked ? ' on' : '');
    lock.textContent = a.locked ? '🔒' : '🔓';
    lock.title = a.locked ? 'Desbloquear' : 'Bloquear';
    lock.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setLocked(a, !a.locked);
      history.push(activeKey()); renderLayers();
    });

    row.append(grip, icon, name, eye, lock);

    row.addEventListener('click', (ev) => {
      if (ev.target === name) return;
      /* Um objeto travado não recebe clique NA TELA — selecioná-lo pela lista é
         a saída que faz o cadeado deixar de dar medo. */
      c.discardActiveObject();
      c.setActiveObject(o);
      c.requestRenderAll();
      syncInspector();
    });

    row.addEventListener('dragstart', () => { dragSrcIndex = idx; row.style.opacity = '.4'; });
    row.addEventListener('dragend', () => { row.style.opacity = ''; dragSrcIndex = null; });
    row.addEventListener('dragover', (ev) => { ev.preventDefault(); row.classList.add('dragover'); });
    row.addEventListener('dragleave', () => row.classList.remove('dragover'));
    row.addEventListener('drop', (ev) => {
      ev.preventDefault();
      row.classList.remove('dragover');
      if (dragSrcIndex === null || dragSrcIndex === idx) return;
      c.moveObjectTo(objs[dragSrcIndex], idx);
      markDirty(activeKey()); c.requestRenderAll();
      history.push(activeKey());               // z-order não dispara evento público no fabric
      renderLayers();
    });

    list.appendChild(row);
  });
}

function setLocked(o: AnyObj, v: boolean) {
  o.locked = v;
  applyLockState(o);
  const c = active();
  if (v && c.getActiveObject() === o) c.discardActiveObject();
  markDirty(activeKey());
  c.requestRenderAll();
}

/* ---------------- sincronizar o inspetor ---------------- */
function syncInspector() {
  if (syncing) return;
  syncing = true;
  try {
    const c = active(), key = activeKey();
    const objs = c.getActiveObjects();
    syncPanels(objs);

    const dims = panelMM(key), mm = mmPerPx(key);
    $('panel-dims').textContent = `${cm1(dims.w / 10)} × ${cm1(dims.h / 10)} cm`;
    $('panel-scale').textContent = `${mm.y.toFixed(2)} mm/px`;

    const texts = objs.filter(isText) as fabric.IText[];
    if (texts.length) {
      const t = texts[0];
      $('font-trigger-label').textContent = t.fontFamily;
      $('font-trigger-label').style.fontFamily = `'${t.fontFamily}'`;
      $('font-current').textContent = t.fontFamily;
      for (const el of $$('#font-menu .font-opt')) el.classList.toggle('on', el.dataset.family === t.fontFamily);
      $<HTMLInputElement>('t-size').value = String(Math.round(pxToCm(t.fontSize, key)));
      const wt = t.fontWeight === 'bold' ? 700 : Number(t.fontWeight) || 400;
      for (const b of $$('#t-weight .seg-btn')) b.classList.toggle('on', Number(b.dataset.w) === wt);
      for (const b of $$('#t-align .seg-btn')) b.classList.toggle('on', b.dataset.a === t.textAlign);
      $<HTMLInputElement>('t-tracking').value = String(t.charSpacing || 0);
      $('t-tracking-val').textContent = ((t.charSpacing || 0) / 10).toFixed(1) + ' %';
      $<HTMLInputElement>('t-leading').value = String(Math.round((t.lineHeight || 1.16) * 100));
      $('t-leading-val').textContent = (t.lineHeight || 1.16).toFixed(2).replace('.', ',');
      if (typeof t.fill === 'string') $<HTMLInputElement>('t-fill').value = t.fill;
      if (typeof t.stroke === 'string' && t.stroke) $<HTMLInputElement>('t-stroke').value = t.stroke;
      $<HTMLInputElement>('t-stroke-w').value = cm1(pxToCm(t.strokeWidth || 0, key));
    }

    const img = objs.find(isImage) as fabric.FabricImage | undefined;
    if (img) {
      $('img-name').textContent = (img as AnyObj).name || '';
      const pct = Math.round((img.opacity ?? 1) * 100);
      $<HTMLInputElement>('i-opacity').value = String(pct);
      $('i-opacity-val').textContent = pct + ' %';
      const r = img.getBoundingRect();
      const printedCm = pxToCm(r.width, key, 'x');
      const dpi = printedCm > 0 ? (img.width || 1) / (printedCm / 2.54) : 0;
      const low = dpi < 40;
      $('img-dpi').className = 'dpi-note' + (low ? ' warn-on' : '');
      $('img-dpi').textContent =
        `${img.width}×${img.height} px em ${cm1(printedCm)} cm · ${Math.round(dpi)} dpi`
        + (low ? ' ⚠ baixa resolução para impressão' : '');
    }

    if (objs.length) {
      const r = (objs.length === 1 ? objs[0] : c.getActiveObject() as fabric.FabricObject).getBoundingRect();
      $<HTMLInputElement>('tf-x').value = String(Math.round(pxToCm(r.left, key, 'x')));
      $<HTMLInputElement>('tf-y').value = String(Math.round(pxToCm(r.top, key, 'y')));
      $<HTMLInputElement>('tf-w').value = String(Math.round(pxToCm(r.width, key, 'x')));
      $<HTMLInputElement>('tf-h').value = String(Math.round(pxToCm(r.height, key, 'y')));
      const ang = objs.length === 1 ? (objs[0].angle || 0) : 0;
      $<HTMLInputElement>('tf-rot').value = String(ang > 180 ? ang - 360 : ang);
      $('tf-rot-val').textContent = Math.round(ang) + '°';
    }

    const multi = objs.length > 1;
    $('align-frame').classList.toggle('hidden', !multi);
    $('align-hint').textContent = !objs.length ? '' : multi ? `${objs.length} objetos` : '1 objeto · ao painel';
    for (const b of $$('[data-dist]')) b.classList.toggle('ctl-off', objs.length < 3);
    for (const b of $$('[data-gap]')) b.classList.toggle('ctl-off', objs.length < 2);

    renderLayers();
    updateFoot(objs);
    updateToolbarState();
  } finally {
    syncing = false;
  }
}

/* ---------------- rodapé ---------------- */
function updateFoot(objs: fabric.FabricObject[]) {
  const foot = $('modal-foot'), key = activeKey(), c = active();
  if (!objs.length) {
    foot.textContent = 'Dica: arraste e solte uma imagem em qualquer lugar do painel · a linha tracejada é a silhueta real do painel';
    return;
  }
  const r = (objs.length === 1 ? objs[0] : c.getActiveObject() as fabric.FabricObject).getBoundingRect();
  const parts = [`${cm1(pxToCm(r.width, key, 'x'))} × ${cm1(pxToCm(r.height, key, 'y'))} cm`];
  if (key !== 'rear') {
    /* x=0 é a TRASEIRA na lateral esquerda e a FRENTE na direita: addLiveryUV()
       inverte o u entre os lados para o desenho ler certo nos dois. */
    const fromFrontPx = key === 'left' ? c.getWidth() - (r.left + r.width) : r.left;
    parts.push(`${cm1(pxToCm(fromFrontPx, key, 'x') / 100)} m da frente`);
  }
  parts.push(`${cm1(pxToCm(c.getHeight() - (r.top + r.height), key, 'y') / 100)} m do piso`);
  foot.textContent = parts.join(' · ');
}

/* ---------------- barra ---------------- */
function updateToolbarState() {
  const key = activeKey(), n = selObjects().length;
  ($$('[data-act="undo"]')[0] as HTMLButtonElement).disabled = !history.canUndo(key);
  ($$('[data-act="redo"]')[0] as HTMLButtonElement).disabled = !history.canRedo(key);
  ($$('[data-act="delete"]')[0] as HTMLButtonElement).disabled = !n;
  ($$('[data-act="duplicate"]')[0] as HTMLButtonElement).disabled = !n;
  ($('btn-mirror') as HTMLButtonElement).disabled = key === 'rear';
  updateSyncDots();
}

function updateSyncDots() {
  const same = sidesMatch();
  for (const tab of $$('#surface-tabs .tab')) {
    const dot = tab.querySelector('.sync-dot');
    if (!dot) continue;
    dot.classList.toggle('on', same);
    tab.title = same ? 'Lados iguais' : 'Lados diferentes — use Espelhar para igualar';
  }
}

async function addText() {
  const c = active(), key = activeKey();
  await ensureFont(DEFAULT_FONT);
  const t = new fabric.IText('Sua marca', {
    left: c.getWidth() / 2, top: c.getHeight() / 2,
    originX: 'center', originY: 'center',
    fontFamily: DEFAULT_FONT,
    fontSize: cmToPx(40, key),            // 40 cm — altura normal do nome de uma frota
    fill: $<HTMLInputElement>('t-fill').value,
  });
  stamp(t as AnyObj, 'Sua marca');
  c.add(t); c.setActiveObject(t);
  markDirty(key); c.requestRenderAll(); history.push(key);
  syncInspector();
}

async function duplicateSelection() {
  const c = active(), key = activeKey();
  const objs = withSelectionFlattened(c);
  if (!objs.length) return;
  const clones = await Promise.all(objs.map((o) => o.clone(EXTRA)));
  for (const o of clones) {
    const a = o as AnyObj;
    a.id = null; stamp(a, a.name);
    o.setXY(o.getXY().add(new fabric.Point(24, 24)));
    o.setCoords();
    c.add(o);
  }
  restoreSelection(c, clones);
  markDirty(key); c.requestRenderAll(); history.push(key);
  syncInspector();
}

function deleteSelection() {
  const c = active(), key = activeKey();
  const objs = c.getActiveObjects();
  if (!objs.length) return;
  for (const o of objs) c.remove(o);
  c.discardActiveObject();
  markDirty(key); c.requestRenderAll(); history.push(key);
  syncInspector();
}

function bindToolbar() {
  for (const btn of $$('.modal-toolbar .tool')) {
    btn.addEventListener('click', async () => {
      const c = active(), key = activeKey();
      switch (btn.dataset.act) {
        case 'text': await addText(); break;
        case 'logo': $('logo-input').click(); break;
        case 'duplicate': await duplicateSelection(); break;
        case 'delete': deleteSelection(); break;
        case 'undo': await history.undo(key); syncInspector(); break;
        case 'redo': await history.redo(key); syncInspector(); break;
        case 'clear':
          for (const o of c.getObjects().slice()) c.remove(o);
          c.backgroundColor = DEFAULT_BG;
          markDirty(key); c.requestRenderAll(); history.push(key);
          syncInspector();
          break;
      }
    });
  }

  $('logo-input').addEventListener('change', async (e) => {
    const input = evTarget<HTMLInputElement>(e);
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await addImageFile(file);
    history.push(activeKey());
    syncInspector();
  });

  $('bgcolor').addEventListener('input', (e) => {
    const c = active();
    c.backgroundColor = evTarget<HTMLInputElement>(e).value;
    markDirty(activeKey()); c.requestRenderAll();
  });
  $('bgcolor').addEventListener('change', () => history.push(activeKey()));
  $('bg-clear').addEventListener('click', () => {
    const c = active();
    c.backgroundColor = '';
    markDirty(activeKey()); c.requestRenderAll(); history.push(activeKey());
  });

  $('stage-zoom').addEventListener('change', (e) => { zoom = evTarget<HTMLSelectElement>(e).value; resize(); });
  $('snap-toggle').addEventListener('change', (e) => setSnapEnabled(evTarget<HTMLInputElement>(e).checked));
}

/* ---------------- espelhar ---------------- */
function bindMirror() {
  const pop = () => $('mirror-pop');
  const label = () => (activeKey() === 'left' ? 'lateral direita' : 'lateral esquerda');

  $('btn-mirror').addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeKey() === 'rear') return;
    $('mirror-pop-title').textContent = `Espelhar para a ${label()}`;
    const dst = otherSide(activeKey());
    const n = dst ? surfaces[dst].getObjects().length : 0;
    $('mirror-warn').textContent = n
      ? `⚠ A arte atual da ${label()} (${n} ${n === 1 ? 'objeto' : 'objetos'}) será substituída. Ctrl+Z desfaz.`
      : '';
    pop().classList.remove('hidden');
  });

  $('mirror-cancel').addEventListener('click', () => pop().classList.add('hidden'));
  $('mirror-go').addEventListener('click', async () => {
    pop().classList.add('hidden');
    const from = activeKey(), to = otherSide(from);
    if (!to) return;
    const mode = pop().querySelector<HTMLInputElement>('input[name="mirror-mode"]:checked')?.value;
    await copySurface(from, to, { reflect: mode === 'reflect' });
    syncInspector();
  });

  $('btn-help').addEventListener('click', (e) => {
    e.stopPropagation();
    $('help-pop').classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!t?.closest?.('#mirror-pop') && !t?.closest?.('#btn-mirror')) pop().classList.add('hidden');
    if (!t?.closest?.('#help-pop') && !t?.closest?.('#btn-help')) $('help-pop').classList.add('hidden');
  });
}

/* ---------------- superfícies ---------------- */
export function showSurface(key: SurfaceKey) {
  setActiveKey(key);
  for (const k of SURFACE_KEYS) stagePanels[k].classList.toggle('hidden', k !== key);
  for (const b of $$('#surface-tabs .tab')) b.classList.toggle('active', b.dataset.surface === key);
  $('editor-caption').textContent = CAPTIONS[key];
  resize();
  syncInspector();
}

export function openEditor(key?: SurfaceKey) {
  modal().classList.remove('hidden');
  showSurface(key || activeKey());
}

export function closeEditor() {
  for (const c of Object.values(surfaces)) { c.discardActiveObject(); c.requestRenderAll(); }
  $('font-menu').classList.add('hidden');
  $('mirror-pop').classList.add('hidden');
  $('help-pop').classList.add('hidden');
  modal().classList.add('hidden');
}

/* ---------------- arrastar e soltar ---------------- */
function bindDnD() {
  const stage = $('modal-stage');
  let depth = 0;
  stage.addEventListener('dragenter', (e) => { e.preventDefault(); if (++depth > 0) stage.classList.add('dragging'); });
  stage.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; stage.classList.remove('dragging'); } });
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', async (e) => {
    e.preventDefault();
    depth = 0;
    stage.classList.remove('dragging');
    const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const c = active();
    const rect = c.upperCanvasEl.getBoundingClientRect();
    let x: number | null = null, y: number | null = null;
    if (rect.width && rect.height &&
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      x = (e.clientX - rect.left) / rect.width * c.getWidth();
      y = (e.clientY - rect.top) / rect.height * c.getHeight();
    }
    await addImageFile(file, x, y);
    history.push(activeKey());
    syncInspector();
  });
}

/* ---------------- teclado ---------------- */
let nudgeTimer = 0;
let nudgeKey: SurfaceKey | null = null;
function nudgeCommit(key: SurfaceKey) {
  nudgeKey = key;
  clearTimeout(nudgeTimer);
  nudgeTimer = window.setTimeout(flushNudge, 450);
}
function flushNudge() {
  if (!nudgeKey) return;
  clearTimeout(nudgeTimer);
  history.push(nudgeKey);
  nudgeKey = null;
  updateToolbarState();
}

function bindKeys() {
  document.addEventListener('keydown', async (e: KeyboardEvent) => {
    if (!isMounted() || !isOpen()) return;
    const c = active(), key = activeKey();
    const ao = c.getActiveObject();
    const tag = (e.target as HTMLElement)?.tagName || '';
    const typing = !!(ao && (ao as fabric.IText).isEditing) || /^(INPUT|TEXTAREA|SELECT)$/.test(tag);
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === 'Escape') {
      if (ao) { c.discardActiveObject(); c.requestRenderAll(); syncInspector(); }
      else closeEditor();
      return;
    }
    if (typing && !mod) return;

    const k = e.key.toLowerCase();
    if (mod && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) await history.redo(key); else await history.undo(key);
      syncInspector();
      return;
    }
    if (mod && k === 'y') { e.preventDefault(); await history.redo(key); syncInspector(); return; }
    if (mod && k === 'd') { e.preventDefault(); await duplicateSelection(); return; }
    if (mod && k === 'a') {
      e.preventDefault();
      const objs = c.getObjects().filter((o) => o.visible && !(o as AnyObj).locked);
      c.discardActiveObject();
      restoreSelection(c, objs);
      c.requestRenderAll(); syncInspector();
      return;
    }
    if (mod && k === 'c') {
      const objs = c.getActiveObjects();
      if (objs.length) clipboard = objs.map((o) => o.toObject(EXTRA));
      return;
    }
    if (mod && k === 'v') {
      if (!clipboard) return;
      e.preventDefault();
      const fams = new Set(clipboard.map((o) => o.fontFamily as string).filter(Boolean));
      await Promise.all([...fams].map(ensureFont));
      const objs = await fabric.util.enlivenObjects<fabric.FabricObject>(clipboard);
      for (const o of objs) {
        const a = o as AnyObj;
        a.id = null; stamp(a, a.name);
        o.setXY(o.getXY().add(new fabric.Point(24, 24)));
        o.setCoords();
        c.add(o);
      }
      c.discardActiveObject();
      restoreSelection(c, objs);
      markDirty(key); c.requestRenderAll(); history.push(key);
      syncInspector();
      return;
    }
    if (mod && (e.key === ']' || e.key === '[')) {
      e.preventDefault();
      for (const o of c.getActiveObjects()) {
        if (e.key === ']') c.bringObjectForward(o); else c.sendObjectBackwards(o);
      }
      markDirty(key); c.requestRenderAll(); history.push(key);
      syncInspector();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key.startsWith('Arrow')) {
      const target = c.getActiveObject();
      if (!target) return;
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      target.setXY(target.getXY().add(new fabric.Point(dx, dy)));
      target.setCoords();
      markDirty(key); c.requestRenderAll();
      nudgeCommit(key);                    // uma seta segurada vira UMA entrada, não quarenta
      syncInspector();
      return;
    }
    if (!mod && k === 't') { e.preventDefault(); await addText(); }
  });

  document.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) flushNudge(); });
}

/* ---------------- init ---------------- */
export function initLiveryEditor() {
  bindToolbar();
  bindTypography();
  bindTransform();
  bindImage();
  bindAlign();
  bindMirror();
  bindDnD();
  bindKeys();

  for (const btn of $$('#surface-tabs .tab')) {
    btn.addEventListener('click', () => showSurface(btn.dataset.surface as SurfaceKey));
  }
  for (const card of $$('.preview-card')) {
    card.addEventListener('click', () => openEditor(card.dataset.surface as SurfaceKey));
  }

  $('modal-close').addEventListener('click', closeEditor);
  modal().addEventListener('pointerdown', (e) => { if (e.target === modal()) closeEditor(); });
  window.addEventListener('resize', () => { if (isOpen()) resize(); });

  /* ANTES do laço abaixo, de propósito: os handlers do fabric disparam na ordem
     de registro, e o encaixe (que roda no object:modified) precisa ajustar a
     posição antes de o histórico gravá-la. Registrado depois, o desfazer
     voltaria para a posição de antes do ajuste — um lugar onde o objeto nunca
     esteve. */
  initSnapping(() => { if (isOpen()) updateFoot(selObjects()); });
  resizeSnapLayers();

  for (const k of SURFACE_KEYS) {
    const c = surfaces[k];

    for (const ev of ['selection:created', 'selection:updated'] as const) {
      c.on(ev, () => { if (k === activeKey()) syncInspector(); });
    }

    /* Escalar uma multi-seleção deixa o fator na ActiveSelection e só o assa nos
       filhos quando a seleção é desfeita — bem depois de object:modified. Então
       normaliza aqui também, ou o campo de corpo mente sobre um texto
       redimensionado em grupo. */
    c.on('selection:cleared', () => {
      if (isRestoring()) return;
      let changed = false;
      c.forEachObject((o) => { if (normalizeTextScale(o)) changed = true; });
      if (changed) { markDirty(k); c.requestRenderAll(); history.push(k); }
      if (k === activeKey()) syncInspector();
    });

    c.on('object:modified', (opt) => {
      if (isRestoring()) return;
      const target = opt.target as fabric.FabricObject | undefined;
      if (target instanceof fabric.ActiveSelection) target.getObjects().forEach(normalizeTextScale);
      else if (target) normalizeTextScale(target);
      markDirty(k); c.requestRenderAll();
      history.push(k);
      if (k === activeKey()) syncInspector();
    });

    c.on('text:changed', (opt) => {
      const t = opt.target as AnyObj | undefined;
      if (t && !t.renamed) t.name = defaultName(t);
      if (k === activeKey()) { renderLayers(); updateToolbarState(); }
    });
    c.on('text:editing:exited', () => history.push(k));
  }

  bindPersistFlush();

  /* Semeia o estado vazio de forma SÍNCRONA: restorePersisted() é assíncrono, e
     uma edição que chegasse antes dele resolver empilharia sobre uma pilha sem
     base, deixando a primeira ação impossível de desfazer. */
  for (const k of SURFACE_KEYS) history.seed(k);
  void restorePersisted()
    .then((ok) => { if (ok) for (const k of SURFACE_KEYS) history.push(k); })
    .finally(() => syncInspector());
}
