/* O modelo de documento da pintura: o que guarda ESTADO, e não pixels nem DOM.

   Imagens carregadas, fontes, desfazer/refazer, normalização da escala do texto,
   a geometria de alinhamento/distribuição, o espelhamento entre as laterais e a
   persistência. Importa só de ./livery.ts; quem chama tudo isto é
   ../ui/livery-editor.ts. */
import * as fabric from 'fabric';
import { surfaces, SURFACE_KEYS, active, activeKey, markDirty, cmToPx, outlineFrame, DEFAULT_BG } from './livery';
import type { SurfaceKey } from './livery';

/* Campos nossos que precisam sobreviver ao toObject/loadFromJSON.
   ATENÇÃO: no fabric v6 canvas.toJSON() NÃO aceita argumentos — passar as
   propriedades ali as descarta em silêncio. Sempre toObject(EXTRA). */
export const EXTRA = ['id', 'name', 'locked', 'assetId'];

type AnyObj = fabric.FabricObject & {
  id?: string | null; name?: string; locked?: boolean; assetId?: string; renamed?: boolean;
};

/* customProperties é estático por classe; declarar nas concretas que usamos
   cobre também o clone(), que não recebe a lista por parâmetro. */
for (const k of ['FabricObject', 'FabricText', 'IText', 'Textbox', 'FabricImage', 'Group'] as const) {
  const C = (fabric as unknown as Record<string, { customProperties?: string[] }>)[k];
  if (C) C.customProperties = EXTRA;
}

export const isText = (o: unknown): o is fabric.FabricText => o instanceof fabric.FabricText;
export const isImage = (o: unknown): o is fabric.FabricImage => o instanceof fabric.FabricImage;

let seq = 0;
export function stamp<T extends AnyObj>(o: T, name?: string): T {
  if (!o.id) o.id = `o${++seq}`;
  if (!o.name) o.name = name;
  return o;
}

/* O fabric NÃO serializa selectable/evented/hasControls/lockMovement* — só o
   nosso `locked` atravessa um round trip. Sem reconstruir os flags a partir dele
   depois de cada re-hidratação (desfazer, espelhar, restaurar), o objeto volta
   dizendo que está travado e arrastando normalmente. */
export function applyLockState<T extends AnyObj>(o: T): T {
  const v = !!o.locked;
  o.set({
    selectable: !v, evented: !v, hasControls: !v, hasBorders: !v,
    lockMovementX: v, lockMovementY: v,
  });
  return o;
}
export const reapplyLocks = (c: fabric.Canvas) => c.forEachObject((o) => applyLockState(o as AnyObj));

/* ---------------- fontes ----------------
   Cada família precisa de um @font-face igual em core/studio.css, e `weights`
   tem de listar exatamente os pesos declarados lá: um peso que existe aqui e
   não no CSS é falseado pelo navegador sobre métricas que o fabric já guardou. */
export interface LiveryFont { family: string; note: string; weights: number[]; }

export const FONTS: LiveryFont[] = [
  { family: 'Anton', note: 'condensada pesada — nome da frota', weights: [400] },
  { family: 'Bebas Neue', note: 'caixa alta estreita', weights: [400] },
  { family: 'Oswald', note: 'condensada versátil', weights: [400, 700] },
  { family: 'Archivo Black', note: 'grotesca pesada, corporativa', weights: [400] },
  { family: 'Montserrat', note: 'geométrica limpa', weights: [400, 700] },
  { family: 'Inter', note: 'neutra — telefone, CNPJ, ANTT', weights: [400, 700] },
  { family: 'Roboto Slab', note: 'serifa grossa — agro, logística', weights: [400, 700] },
  { family: 'Playfair Display', note: 'serifada elegante', weights: [400, 700] },
  { family: 'Pacifico', note: 'manuscrita', weights: [400] },
  { family: 'Allerta Stencil', note: 'estêncil industrial', weights: [400] },
];
export const DEFAULT_FONT = 'Anton';
const fontWeights = (f: string) => FONTS.find((x) => x.family === f)?.weights ?? [400];

const loadedFonts = new Set<string>();
export const fontLoaded = (f: string) => loadedFonts.has(f);

/* O fabric mede a largura dos glifos com ctx.measureText no nascimento do objeto
   e memoiza por família em fabric.cache.charWidthsCache. Se a webfont ainda não
   chegou ele mede a SUBSTITUTA e guarda aquilo com o nome da família certa — o
   texto passa a pintar certo e a manter largura/altura erradas para sempre.
   Portanto: sempre esperar isto antes de aplicar uma família. */
export async function ensureFont(family: string): Promise<void> {
  if (loadedFonts.has(family)) return;
  try {
    await Promise.all(fontWeights(family).map((w) => document.fonts.load(`${w} 40px "${family}"`)));
    await document.fonts.ready;
  } catch { /* no pior caso medimos a substituta */ }
  loadedFonts.add(family);
  fabric.cache.clearFontCache(family);
  remeasureFamily(family);
}

export function remeasureFamily(family: string) {
  for (const k of SURFACE_KEYS) {
    const c = surfaces[k];
    let touched = false;
    c.forEachObject((o) => {
      const t = o as fabric.IText;
      if (!isText(t) || t.fontFamily !== family) return;
      (t as unknown as { _clearCache?: () => void })._clearCache?.();
      t.initDimensions();
      t.setCoords();
      t.set('dirty', true);        // objectCaching está ligado: sem isto o bitmap velho fica
      touched = true;
    });
    if (touched) { markDirty(k); c.requestRenderAll(); }
  }
}

/* ---------------- imagens ----------------
   O código antigo revogava a object URL logo depois de o fabric carregar, o que
   deixava cada imagem segurando uma blob: URL MORTA. Qualquer coisa que
   re-hidratasse a partir do JSON — desfazer, espelhar, recarregar — restaurava
   um vazio. A blob URL agora vive a sessão inteira (string curta, então os
   instantâneos do histórico continuam pequenos) e o data URL fica ao lado dela
   para a persistência. */
interface Asset { name: string; dataUrl: string; url: string; }
const assets = new Map<string, Asset>();
export const assetOf = (id?: string) => (id ? assets.get(id) : undefined);

const readAsDataUrl = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result as string);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(file);
});

export async function registerAsset(file: File) {
  const dataUrl = await readAsDataUrl(file);
  const id = `a${assets.size + 1}_${Date.now().toString(36)}`;
  assets.set(id, { name: file.name.replace(/\.[^.]+$/, ''), dataUrl, url: URL.createObjectURL(file) });
  return { id, ...(assets.get(id) as Asset) };
}

function registerDataUrl(dataUrl: string, name?: string) {
  for (const [id, a] of assets) if (a.dataUrl === dataUrl) return { id, ...a };
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const mime = /^data:([^;]+)/.exec(dataUrl)?.[1] ?? 'image/png';
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const id = `a${assets.size + 1}_${Date.now().toString(36)}`;
  assets.set(id, { name: name || 'Imagem', dataUrl, url: URL.createObjectURL(new Blob([buf], { type: mime })) });
  return { id, ...(assets.get(id) as Asset) };
}

export async function addImageFile(file: File, x?: number | null, y?: number | null) {
  const asset = await registerAsset(file);
  const img = await fabric.FabricImage.fromURL(asset.url);
  const c = active();
  const s = Math.min(c.getWidth() / 3 / img.width, c.getHeight() / 1.6 / img.height);
  img.set({
    left: x ?? c.getWidth() / 2, top: y ?? c.getHeight() / 2,
    originX: 'center', originY: 'center', scaleX: s, scaleY: s,
  });
  (img as AnyObj).assetId = asset.id;
  stamp(img as AnyObj, asset.name);
  c.add(img);
  c.setActiveObject(img);
  markDirty(activeKey());
  c.requestRenderAll();
  return img;
}

/* ---------------- escala do texto ----------------
   fontSize é nominal; o que aparece é fontSize x scaleY. Arrastar um canto muda
   a escala e deixa o fontSize intacto, então "40 cm" no inspetor deixa de
   significar qualquer coisa depois do primeiro redimensionamento. */
export function normalizeTextScale(o: fabric.FabricObject): boolean {
  if (!isText(o) || (o.scaleX === 1 && o.scaleY === 1)) return false;
  const t = o as fabric.Textbox;
  if (o instanceof fabric.Textbox) {
    t.set({ width: t.width * t.scaleX, fontSize: t.fontSize * t.scaleY, scaleX: 1, scaleY: 1 });
  } else {
    // uniformScaling está ligado, então os dois fatores concordam. Nunca
    // arredondar aqui: redimensionar → arredondar → redimensionar acumula erro.
    t.set({ fontSize: t.fontSize * (t.scaleX + t.scaleY) / 2, scaleX: 1, scaleY: 1 });
  }
  t.initDimensions(); t.setCoords(); t.set('dirty', true);
  return true;
}

/* ---------------- histórico ----------------
   Pilha de instantâneos e não um padrão de comandos: o fabric já traz um par
   serializar/desserializar testado, as imagens serializam como uma blob: URL
   curta, e escrever o inverso de cada operação seria mais código do que o editor
   inteiro. */
const HIST_LIMIT = 40;
type Stack = { u: string[]; r: string[] };
const hist: Record<SurfaceKey, Stack> = {
  left: { u: [], r: [] }, right: { u: [], r: [] },
  rear: { u: [], r: [] }, front: { u: [], r: [] }, roof: { u: [], r: [] },
};
let restoring = false;
export const isRestoring = () => restoring;

const snap = (c: fabric.Canvas) => JSON.stringify({ o: c.toObject(EXTRA), bg: c.backgroundColor ?? '' });

export const history = {
  seed(key: SurfaceKey) { if (!hist[key].u.length) hist[key].u.push(snap(surfaces[key])); },

  push(key: SurfaceKey) {
    if (restoring) return;
    const st = hist[key], s = snap(surfaces[key]);
    if (st.u[st.u.length - 1] === s) return;      // descarta modificações que não mudaram nada
    st.u.push(s);
    if (st.u.length > HIST_LIMIT) st.u.shift();
    st.r.length = 0;                               // qualquer edição nova mata o galho do refazer
    schedulePersist();
  },

  canUndo(key: SurfaceKey) { return hist[key].u.length > 1; },
  canRedo(key: SurfaceKey) { return hist[key].r.length > 0; },

  async undo(key: SurfaceKey) {
    const st = hist[key];
    if (st.u.length < 2) return false;
    st.r.push(st.u.pop() as string);
    await applySnapshot(key, st.u[st.u.length - 1]);
    return true;
  },

  async redo(key: SurfaceKey) {
    const st = hist[key];
    if (!st.r.length) return false;
    const s = st.r.pop() as string;
    st.u.push(s);
    await applySnapshot(key, s);
    return true;
  },
};

async function applySnapshot(key: SurfaceKey, raw: string) {
  const c = surfaces[key];
  const state = JSON.parse(raw) as { o: Record<string, unknown>; bg: string };
  const fams = new Set<string>();
  for (const o of (state.o.objects as { fontFamily?: string }[] | undefined) ?? []) {
    if (o.fontFamily) fams.add(o.fontFamily);
  }
  await Promise.all([...fams].map(ensureFont));

  restoring = true;
  try {
    await c.loadFromJSON(state.o);
    c.backgroundColor = state.bg;
    reapplyLocks(c);
  } finally {
    restoring = false;
  }
  markDirty(key);
  c.requestRenderAll();
  schedulePersist();
}

/* ---------------- geometria ----------------
   A regra que governa tudo abaixo: no fabric as LEITURAS são absolutas
   (getBoundingRect, getXY) e as ESCRITAS via left/top são relativas ao PAI. Num
   objeto dentro de uma ActiveSelection, `left` é um deslocamento a partir do
   centro da seleção, muitas vezes negativo. Misturar os dois é o bug clássico do
   alinhamento — e parece correto com um objeto só, porque aí não há grupo. */
const P = (x: number, y: number) => new fabric.Point(x, y);

export function moveBy(o: fabric.FabricObject, dx: number, dy: number) {
  o.setXY(o.getXY().add(P(dx, dy)));    // absoluto entra, absoluto sai; independe da origem
  o.setCoords();
}

/* Desfaz a seleção, mexe em objetos de primeiro nível, remonta a seleção.
   discardActiveObject assa a transformação do grupo de volta em cada filho, então
   as posições se preservam e todo getBoundingRect abaixo é trivialmente absoluto
   — o que também tira o LayoutManager do v6 do caminho. */
export function withSelectionFlattened(c: fabric.Canvas) {
  const objs = c.getActiveObjects().slice();
  if (objs.length) c.discardActiveObject();
  return objs;
}

export function restoreSelection(c: fabric.Canvas, objs: fabric.FabricObject[]) {
  if (objs.length === 1) c.setActiveObject(objs[0]);
  else if (objs.length > 1) c.setActiveObject(new fabric.ActiveSelection(objs, { canvas: c }));
}

interface Frame { left: number; top: number; width: number; height: number; }

export function selectionFrame(objs: fabric.FabricObject[]): Frame {
  const rs = objs.map((o) => o.getBoundingRect());
  const l = Math.min(...rs.map((r) => r.left));
  const t = Math.min(...rs.map((r) => r.top));
  return {
    left: l, top: t,
    width: Math.max(...rs.map((r) => r.left + r.width)) - l,
    height: Math.max(...rs.map((r) => r.top + r.height)) - t,
  };
}

type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
const ALIGN: Record<AlignMode, { d: 'x' | 'y'; at: (f: Frame, r: Frame) => number }> = {
  left: { d: 'x', at: (f, r) => f.left - r.left },
  hcenter: { d: 'x', at: (f, r) => f.left + f.width / 2 - r.width / 2 - r.left },
  right: { d: 'x', at: (f, r) => f.left + f.width - r.width - r.left },
  top: { d: 'y', at: (f, r) => f.top - r.top },
  vcenter: { d: 'y', at: (f, r) => f.top + f.height / 2 - r.height / 2 - r.top },
  bottom: { d: 'y', at: (f, r) => f.top + f.height - r.height - r.top },
};

export function align(mode: AlignMode, frameKind: 'selection' | 'outline') {
  const c = active(), key = activeKey();
  const objs = withSelectionFlattened(c).filter((o) => !(o as AnyObj).locked);
  if (!objs.length) return;
  const frame = frameKind === 'selection' ? selectionFrame(objs) : outlineFrame(key);
  const { d, at } = ALIGN[mode];
  for (const o of objs) {
    const delta = at(frame, o.getBoundingRect());
    moveBy(o, d === 'x' ? delta : 0, d === 'y' ? delta : 0);
  }
  restoreSelection(c, objs);
  markDirty(key); c.requestRenderAll(); history.push(key);
}

/* gapCm null espalha o vão existente por igual (precisa de 3+); um número
   dispõe em sequência com aquele vão, ancorado no primeiro. */
export function distribute(axis: 'x' | 'y', gapCm: number | null = null) {
  const c = active(), key = activeKey();
  const objs = withSelectionFlattened(c).filter((o) => !(o as AnyObj).locked);
  if (objs.length < (gapCm === null ? 3 : 2)) { restoreSelection(c, objs); return; }

  const K = axis === 'x'
    ? { s: 'left' as const, e: (r: Frame) => r.left + r.width, size: (r: Frame) => r.width }
    : { s: 'top' as const, e: (r: Frame) => r.top + r.height, size: (r: Frame) => r.height };

  // ler TODOS os retângulos antes de mover: ler dentro do laço mede geometria já
  // deslocada e o erro se acumula
  const items = objs.map((o) => ({ o, r: o.getBoundingRect() as Frame }))
    .sort((a, b) => a.r[K.s] - b.r[K.s]);
  const total = items.reduce((s, it) => s + K.size(it.r), 0);

  let cursor = items[0].r[K.s];
  const step = gapCm === null
    ? (K.e(items[items.length - 1].r) - items[0].r[K.s] - total) / (items.length - 1)
    : cmToPx(gapCm, key, axis);

  for (const it of items) {
    const d = cursor - it.r[K.s];
    moveBy(it.o, axis === 'x' ? d : 0, axis === 'y' ? d : 0);
    cursor += K.size(it.r) + step;
  }

  restoreSelection(c, objs);
  markDirty(key); c.requestRenderAll(); history.push(key);
}

/* ---------------- espelhar para a outra lateral ----------------
   addLiveryUV() (./models.ts) já desespelha: a SIDE_L usa u = (z-minZ)/span e a
   SIDE_R usa u = (maxZ-z)/span, então a mesma tela lê no sentido certo dos dois
   lados. Um repeat.x = -1 na textura REINTRODUZIRIA o texto invertido — não
   conserta nada.
   O que o flip custa é a POSIÇÃO: com a frente do baú no +Z, o x=0 da tela é a
   TRASEIRA na lateral esquerda e a FRENTE na direita. Copiar uma na outra ao pé
   da letra leva o logo da cabine para junto das portas. Espelhar as posições em
   x — sem tocar em flipX — devolve a arte ao mesmo ponto físico e mantém a
   leitura. 'reflect' é a saída deliberada para quem quer o espelho de verdade. */
export async function copySurface(
  fromKey: SurfaceKey, toKey: SurfaceKey, opts: { reflect?: boolean } = {},
) {
  const src = surfaces[fromKey], dst = surfaces[toKey];
  history.seed(toKey);

  const fams = new Set<string>();
  src.forEachObject((o) => { if (isText(o)) fams.add((o as fabric.IText).fontFamily); });
  await Promise.all([...fams].map(ensureFont));

  const json = src.toObject(EXTRA);
  restoring = true;
  try {
    await dst.loadFromJSON(json);
    dst.backgroundColor = src.backgroundColor ?? DEFAULT_BG;
  } finally {
    restoring = false;
  }

  const w = dst.getWidth();
  dst.forEachObject((o) => {
    const a = o as AnyObj;
    a.id = null; stamp(a, a.name);       // ids novos: os dois lados seguem distinguíveis
    const p = o.getXY();
    o.setXY(new fabric.Point(w - p.x, p.y));
    if (opts.reflect) o.set('flipX', !o.flipX);
    applyLockState(a);
    o.setCoords();
  });

  for (const f of fams) remeasureFamily(f);
  markDirty(toKey);
  dst.requestRenderAll();
  history.push(toKey);
}

/* Comparação estrutural barata para os pontos das abas dizerem se as duas
   laterais ainda carregam a mesma arte. Ignora id e left, que diferem por
   construção depois de um espelhamento. */
export function sidesMatch(): boolean {
  const strip = (key: SurfaceKey) => JSON.stringify(
    (surfaces[key].toObject(EXTRA).objects as Record<string, unknown>[]).map((o) => {
      const { id: _id, name: _name, left: _left, ...rest } = o;
      return rest;
    }));
  return strip('left') === strip('right');
}

/* ---------------- persistência ---------------- */
const STORE_KEY = 'truckstudio.livery.v1';
let persistTimer = 0;

/* blob: URLs valem só a sessão, então o data URL entra na saída e uma blob nova
   é criada na volta */
function toPersistable(key: SurfaceKey) {
  const json = surfaces[key].toObject(EXTRA);
  for (const o of (json.objects as { assetId?: string; src?: string }[] | undefined) ?? []) {
    const a = assetOf(o.assetId);
    if (a) o.src = a.dataUrl;
  }
  return { o: json, bg: surfaces[key].backgroundColor ?? '' };
}

export function persistNow() {
  try {
    const payload: Record<string, unknown> = { v: 1 };
    for (const k of SURFACE_KEYS) payload[k] = toPersistable(k);
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch { /* cota ou aba anônima — persistir aqui é conveniência */ }
}

function schedulePersist() {
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(persistNow, 400);   // sliders não podem martelar o localStorage
}

export async function restorePersisted(): Promise<boolean> {
  let payload: Record<string, { o: Record<string, unknown>; bg?: string }> & { v?: number };
  try { payload = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return false; }
  if (!payload || payload.v !== 1) return false;

  const fams = new Set<string>();
  for (const k of SURFACE_KEYS) {
    for (const o of (payload[k]?.o?.objects as { fontFamily?: string }[] | undefined) ?? []) {
      if (o.fontFamily) fams.add(o.fontFamily);
    }
  }
  await Promise.all([...fams].map(ensureFont));

  restoring = true;
  try {
    for (const k of SURFACE_KEYS) {
      const st = payload[k];
      if (!st?.o) continue;
      for (const o of (st.o.objects as { src?: string; assetId?: string; name?: string }[] | undefined) ?? []) {
        if (typeof o.src === 'string' && o.src.startsWith('data:')) {
          const a = registerDataUrl(o.src, o.name);
          o.assetId = a.id;
          o.src = a.url;
        }
      }
      await surfaces[k].loadFromJSON(st.o);
      surfaces[k].backgroundColor = st.bg ?? DEFAULT_BG;
      reapplyLocks(surfaces[k]);
      markDirty(k);
      surfaces[k].requestRenderAll();
    }
  } catch (err) {
    console.error('[livery] restaurar:', err);
    return false;
  } finally {
    restoring = false;
  }
  for (const f of fams) remeasureFamily(f);
  return true;
}

export function bindPersistFlush() {
  const flush = () => { clearTimeout(persistTimer); persistNow(); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}
