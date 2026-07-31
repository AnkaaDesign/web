/* Sidebar / topbar wiring: car-paint controls and view controls.

   What is deliberately NOT here any more:
   - the model switcher, replaced by the bottom-left truck badge (selector.ts),
   - the topbar "Trocar" button, replaced by the two viewport badges,
   - the whole lighting panel, replaced by the glass HUD (hud.ts).
   Each of those was a second control surface writing state another surface
   already owned, which is how a UI ends up disagreeing with itself. */
import { frameAll, controls } from '../scene/scene';
import { captureViewport } from '../scene/capture';
import { state, setPaintTarget } from '../vehicle/models';
import { setPaint, getPaintParams, resetPaint } from '../vehicle/paint';
import type { PaintFinish, PaintParams } from '../vehicle/paint';
import { setBackgroundsForPaint } from '../vehicle/livery';
import type { Choice } from '../catalog/catalog';
import { $, $$, evTarget, evCurrent } from '../core/dom';

export const setStatus = (t: string) => { $('status').textContent = t; };

/** Applies a catalog choice; injected by studio.ts. See setChoiceApplier(). */
export type ChoiceApplier =
  (choice: Choice, opts?: { first?: boolean; curtain?: boolean }) => Promise<Choice | null>;

/* studio.ts injects applyChoice here instead of this module importing it:
   studio.ts already imports this one, and closing that cycle would make boot
   order depend on module-evaluation subtleties. Kept because the paint/view
   controls may yet need to trigger a reload; nothing in this file calls it
   today, which is why it is reachable only through the accessor below. */
let applyChoice: ChoiceApplier | null = null;

export function setChoiceApplier(fn: ChoiceApplier) { applyChoice = fn; }

/** The applier studio.ts injected, for a future control that needs to reload. */
export function getChoiceApplier(): ChoiceApplier | null { return applyChoice; }

/* ---------------- paint ----------------
   Every control funnels through paint.setPaint(); nothing here knows how a
   parameter maps onto a material or a uniform. */

/* [range id, param, readout id] — the range's 0..100 maps onto the parameter */
const PAINT_RANGES: [id: string, param: keyof PaintParams, valId: string][] = [
  ['paint-cc-gloss', 'ccGloss', 'cc-gloss-val'],
  ['paint-peel', 'peel', 'peel-val'],
  ['paint-metallic', 'metallic', 'metallic-val'],
  ['paint-flop', 'flop', 'flop-val'],
  ['paint-pearl', 'pearl', 'pearl-val'],
  ['paint-pearl-sharp', 'pearlSharp', 'pearl-sharp-val'],
  ['paint-flake-size', 'flakeSize', 'flake-size-val'],
  ['paint-flake-glint', 'flakeGlint', 'flake-glint-val'],
];
const FINISH_LABELS: Record<PaintFinish, string> = {
  solid: 'Sólida', metallic: 'Metálica', pearl: 'Perolizada',
};

export function syncPaintUI() {
  const p = getPaintParams();
  $<HTMLInputElement>('paint-color').value = p.color;
  $<HTMLInputElement>('paint-pearl-color').value = p.pearlColor;
  $<HTMLInputElement>('paint-flake-color').value = p.flakeColor;
  for (const [id, keyName, valId] of PAINT_RANGES) {
    const v = Math.round(Number(p[keyName] ?? 0) * 100);
    $<HTMLInputElement>(id).value = String(v);
    $(valId).textContent = v + '%';
  }
  /* finish selector + conditional groups. `data-finish` may list more than one
     finish ("metallic pearl") because flakes are shared: real 3-coat pearls do
     sparkle, they just do it at about a third of the density. */
  for (const b of $('paint-finish').querySelectorAll<HTMLElement>('.seg-btn')) {
    b.classList.toggle('on', b.dataset.finish === p.finish);
  }
  for (const g of $$('.paint-group')) {
    g.classList.toggle('on', (g.dataset.finish || '').split(' ').includes(p.finish));
  }
  $('paint-finish-label').textContent = FINISH_LABELS[p.finish] || '';
}

function bindPaint() {
  for (const [id, keyName, valId] of PAINT_RANGES) {
    $(id).addEventListener('input', (e) => {
      const { value } = evTarget<HTMLInputElement>(e);
      setPaint({ [keyName]: +value / 100 });
      $(valId).textContent = value + '%';
    });
  }
  /* The base colour also re-derives the flake and flop tints, so the whole
     panel has to resync — picking a red must not leave a blue flake tint. */
  $('paint-color').addEventListener('input', (e) => {
    setPaint({ color: evTarget<HTMLInputElement>(e).value });
    syncPaintUI();
  });
  $('paint-flake-color').addEventListener('input', (e) =>
    setPaint({ flakeColor: evTarget<HTMLInputElement>(e).value }));
  $('paint-pearl-color').addEventListener('input', (e) =>
    setPaint({ pearlColor: evTarget<HTMLInputElement>(e).value }));
  for (const b of $('paint-finish').querySelectorAll<HTMLElement>('.seg-btn')) {
    b.addEventListener('click', () => {
      /* Switching finish resets the finish-specific parameters to that
         family's defaults — carrying a metallic's flake density into a solid
         paint would produce a finish that does not exist. */
      setPaint({ finish: b.dataset.finish as PaintFinish });
      syncPaintUI();
    });
  }

  $('paint-trailer').addEventListener('change', (e) => {
    const { checked } = evTarget<HTMLInputElement>(e);
    setPaintTarget(checked ? 'both' : 'cab');
    setBackgroundsForPaint(checked);   // white canvas bg would hide the paint
    setStatus(checked
      ? 'Pintura aplicada à cabine e ao implemento (incluindo a frente)'
      : 'Pintura somente na cabine');
  });
}

/* ---------------- topbar + view controls ----------------
   Os dois toggles de visibilidade seguem na topbar; enquadrar/girar/capturar
   moraram lá e agora ficam SOBRE o render, no canto superior direito
   (#view-controls, em core/template.ts). Os ids não mudaram, então a ligação
   daqui é a mesma — só o lugar onde os botões aparecem é que mudou. */
function bindTopbar() {
  $('show-cab').addEventListener('change', (e) => {
    state.cabGroup.visible = evTarget<HTMLInputElement>(e).checked;
  });
  $('show-trailer').addEventListener('change', (e) => {
    state.trailerGroup.visible = evTarget<HTMLInputElement>(e).checked;
  });

  /* #canvas-holder guarda o canvas e estes botões como IRMÃOS, e scene.ts liga o
     OrbitControls a `renderer.domElement` — o canvas, não o holder — então hoje
     um clique aqui não tem caminho de bolha até os controles. Isto é a guarda
     para o dia em que tiver: sem ela, apertar "Screenshot" começaria a arrastar
     a câmera por baixo do botão. Mesma proteção que ui/hud.ts e os badges do
     seletor já aplicam. `wheel` é passivo: só precisa não viajar. */
  const cluster = $('view-controls');
  const swallow = (e: Event) => e.stopPropagation();
  cluster.addEventListener('pointerdown', swallow);
  cluster.addEventListener('pointerup', swallow);
  cluster.addEventListener('wheel', swallow, { passive: true });

  $('btn-reset').addEventListener('click', () => frameAll([state.cabGroup, state.trailerGroup]));
  $('btn-turn').addEventListener('click', (e) => {
    controls.autoRotate = !controls.autoRotate;
    controls.autoRotateSpeed = 1.2;
    const btn = evCurrent(e);
    btn.classList.toggle('on', controls.autoRotate);
    /* O botão declara aria-pressed no template, então ele TEM de acompanhar —
       um toggle que anuncia "não pressionado" enquanto gira é pior do que um
       que não anuncia nada. */
    btn.setAttribute('aria-pressed', controls.autoRotate ? 'true' : 'false');
  });
  $('btn-shot').addEventListener('click', () => { void runCapture(); });
}

/* ---------------- captura em alta resolução ----------------
   A UI da coisa; o trabalho pesado é de scene/capture.ts, que documenta por que
   um toDataURL do canvas visível saía em ~1500x900. Aqui só mora o que é DOM:
   a pílula, o guarda de reentrância e o download. */

/* Um clique de cada vez. captureViewport() para o loop de render e
   redimensiona o buffer; um segundo clique no meio pegaria o renderer já
   remexido e devolveria o estado errado no seu próprio finally. */
let capturing = false;

/* Um rAF agenda DEPOIS do próximo cálculo de estilo/layout; o segundo só roda
   depois que aquele quadro foi pintado. Duas voltas, portanto, é o mínimo que
   garante que a pílula está NA TELA antes de a captura travar a thread — com
   uma só, o indicador aparece quando o trabalho que ele anuncia já acabou. */
const painted = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  /* Revogar na mesma volta cancela o download em alguns motores: o clique só
     ENFILEIRA a busca da blob: URL. Alguns segundos cobrem isso com folga, e o
     PNG (dezenas de MB em 12 MP) não fica pendurado na memória além disso —
     que é justamente o que este recurso não pode fazer. */
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function runCapture() {
  if (capturing) return;
  capturing = true;

  const btn = $<HTMLButtonElement>('btn-shot');
  const pill = $('ts-shot');
  btn.disabled = true;
  pill.classList.remove('hidden');   /* o texto é do template; ninguém o reescreve */

  try {
    await painted();
    const shot = await captureViewport();
    downloadBlob(shot.blob, 'truck-studio.png');
    setStatus(`Imagem salva · ${shot.width} × ${shot.height}`);
  } catch (err: unknown) {
    console.error('[truck-studio] captura falhou', err);
    setStatus('Não foi possível gerar a imagem.');
  } finally {
    pill.classList.add('hidden');
    btn.disabled = false;
    capturing = false;
  }
}

export function initUI() {
  bindTopbar();
  bindPaint();
}

/* Kept as a boot-sequence hook even though the sidebar no longer renders anything
   derived from the manifests — studio.ts calls it between loadManifests() and the
   first load, and a future sidebar panel will want that slot. */
export function afterManifests() {}

/* Called once, after the first cab+trailer are in the scene. #brand-sub is NOT
   touched here: applyChoice() owns it, so it stays right on every later change. */
export function afterLoad() {
  resetPaint();          // ship the default metallic silver on every boot
  syncPaintUI();
}
