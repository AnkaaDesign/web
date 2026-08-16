/* The loading curtain — the transition between "I picked this truck" and "here
   is my truck, standing in the scene".
   ---------------------------------------------------------------------------
   Why this is not a spinner: choosing a model is the emotional beat of the whole
   configurator, and the payoff (a cab FBX up to 44 MB plus an environment HDRI)
   takes real seconds. A generic spinner throws that beat away. The curtain keeps
   the chosen truck on screen for the whole wait and then FLIES it into the
   bottom-left badge, so the badge reads as where the truck came to rest instead
   of as a widget that popped into existence.

   Ownership: this module builds and owns everything under #ts-loader. The badge
   (#ts-badge) belongs to ui/selector.ts, which fills AND un-hides it before the
   overlay closes — so by the time the outro runs the badge is already sitting
   there at z-index 8, hidden only by our own scrim at z-index 400. We measure it
   and never mutate it.

   Lifecycle: the engine is a singleton that OUTLIVES the React page (see the
   header of studio.ts). Every rAF, timer and listener started here is therefore
   torn down the moment the curtain hides — a leaked loop would keep running for
   the entire browser session, long after the route is gone. */
import { root, $opt, el as make, initials, clamp01 } from '../core/dom';

/* ---------------- a pílula de estado (#cab-switching) ----------------
   O IRMÃO DISCRETO DA CORTINA, e ele mora aqui pelo mesmo motivo que a cortina:
   os dois são o vocabulário de "espere um pouco" do estúdio, e ter dois donos
   para isso é como uma interface acaba discordando de si mesma.

   Ela vivia dentro de studio.ts, privada. Mas a preferência do produto é
   EXPLÍCITA — "sempre mostrar loading em vez de renderizar incompleto ou travar
   durante o uso" — e quem trava não é só o studio.ts: um clique de preset de
   clima (ui/hud.ts) abre um tween de 0,8 s em que cada quadro redesenha o mapa
   de sombra inteiro. O hud não pode importar studio.ts (studio importa hud), e a
   saída certa não é um segundo indicador: é este, promovido a um módulo que os
   dois já importam.

   UM elemento, mais de um dono possível, então ninguém escreve nele direto. As
   reivindicações formam uma PILHA e quem aparece é a MAIS ANTIGA: a pílula
   descreve o que está acontecendo agora, não o que está esperando a vez. */

interface PillClaim { text: string }
const pillClaims: PillClaim[] = [];

/** O identificador do que a reivindicação devolve. `release()` é idempotente. */
export interface PillHandle {
  set(next: string): void;
  release(): void;
}

function drawPill() {
  /* $opt e não $: a pílula é do template, e um template que mudou embaixo de nós
     não pode derrubar o carregamento que ela apenas ANUNCIA. */
  const box = $opt('cab-switching');
  const text = $opt('cab-switching-text');
  if (!box) return;
  const showing = pillClaims[0];
  if (!showing) { box.classList.add('hidden'); return; }
  if (text) text.textContent = showing.text;
  box.classList.remove('hidden');
}

/** Reivindica a pílula de estado. Sempre solte no `finally`. */
export function claimPill(text: string): PillHandle {
  const claim: PillClaim = { text };
  pillClaims.push(claim);
  drawPill();
  return {
    set(next: string) { claim.text = next; drawPill(); },
    release() {
      const i = pillClaims.indexOf(claim);
      if (i >= 0) pillClaims.splice(i, 1);
      drawPill();
    },
  };
}

/**
 * Cede um quadro ao navegador.
 *
 * OBRIGATÓRIO antes de todo bloco síncrono e pesado que acabou de anunciar a si
 * mesmo: sem isto o rótulo novo só apareceria DEPOIS do trabalho que ele
 * anuncia, que é o mesmo que não anunciar nada. Era um `const` local de
 * `runApply()` em studio.ts; virou módulo quando os quatro outros pontos de
 * travamento (cor, redimensionamento do baú, preset de luz, captura) passaram a
 * precisar dele.
 *
 * ⚠️ LIMITADO NO TEMPO, e isto NÃO é zelo excessivo — é um travamento medido.
 * `requestAnimationFrame` NÃO DISPARA numa aba em segundo plano (nem numa que o
 * navegador parou de compor). Um `await` cru nele pendura para sempre quem
 * esperar: a cortina de carregamento congela no rótulo da fase, a fila de
 * aplicações para de andar, e o usuário volta para a aba e encontra
 * "Posicionando o veículo… 0%" para o resto da sessão. Foi exatamente o que
 * aconteceu ao verificar isto com a aba sem compor.
 *
 * A saída tem dois degraus, e o primeiro é o que importa:
 *
 * 1. ABA ESCONDIDA → resolve NA HORA. Não há quadro para ceder: nada vai ser
 *    pintado, então esperar por uma pintura é esperar por nada. Isto não é só
 *    mais rápido, é a diferença entre um carregamento que termina em segundo
 *    plano e um que rasteja — o Chrome aplica *intensive throttling* a
 *    `setTimeout` numa aba escondida há mais de 5 min (um disparo por MINUTO), e
 *    uma sequência de esperas presa nisso leva minutos para atravessar quatro
 *    fases.
 * 2. ABA VISÍVEL → `requestAnimationFrame`, com `setTimeout` de 250 ms como
 *    rede de segurança para a janela em que a aba fica escondida ENTRE o teste
 *    acima e o callback.
 *
 * Ceder o quadro é uma OTIMIZAÇÃO DE APRESENTAÇÃO; nunca pode ser o motivo de
 * um carregamento não terminar.
 */
export function paintFrame(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(done);
    setTimeout(done, 250);
  });
}

/**
 * Envolve um trabalho síncrono e pesado na pílula: anuncia, deixa o navegador
 * PINTAR o anúncio, roda, e solta — inclusive se o trabalho lançar.
 *
 * Este é o helper que fecha os "cliques perdidos": um clique que muda a cena mas
 * não mostra nada por 300 ms é indistinguível de um clique que se perdeu.
 */
export async function withPill<T>(text: string, job: () => T | Promise<T>): Promise<T> {
  const pill = claimPill(text);
  try {
    await paintFrame();
    return await job();
  } finally {
    pill.release();
  }
}

/* ---------------- O ENCAIXE DE TRABALHO LONGO ----------------
   ⚠️ ESTE BLOCO EXISTE PORQUE A CORTINA GANHOU UM SEGUNDO CLIENTE, e ele mudou o
   que ela precisa ser. Ela nasceu para o CARREGAMENTO DE MODELO: segundos de
   espera, uma frase de fase, e nada para o usuário fazer além de esperar. Depois
   a GRAVAÇÃO DE VÍDEO passou a subi-la para esconder o laço offline (ver
   ui/chrome.ts), e ali a espera dura MINUTOS — tempo em que a pessoa quer saber
   quanto já andou, quanto falta, e quer poder DESISTIR.

   A primeira tentativa foi flutuar uma segunda caixa por cima da cortina com
   esses detalhes e o botão. O dono reprovou na tela: *"junto do loading, onde
   mostra a progressbar, mostre quanto tempo se passou e quanto tempo falta lá,
   não precisa desse segundo loading"*. Ele está certo — duas caixas de progresso
   ao mesmo tempo leem como duas coisas acontecendo, não como uma.

   O ENCAIXE É GENÉRICO DE PROPÓSITO: linhas de texto e uma ação, sem uma palavra
   sobre vídeo. Quem sabe o que escrever é quem está esperando — a carga de
   modelo é a outra cliente e um dia vai querer o mesmo ("cancelar o download",
   "3 de 4 texturas"). Um `setRecordingDetail()` aqui dentro faria esta cortina
   conhecer o gravador, que é exatamente a dependência que ela não pode ter.

   ⚠️ E NÃO HÁ TERCEIRO SLOT. Duas coisas bastam para o que existe hoje, e um
   encaixe com sete campos é um componente novo disfarçado de parâmetro. */

/** Um botão dentro da cortina. Sem ele, o usuário só pode esperar. */
export interface LoaderAction {
  label: string;
  /** Vira `title` e nome acessível — é onde mora o preço do clique. */
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}

/** Linhas curtas sob a barra, mais a ação. `null` limpa tudo. */
export interface LoaderDetail {
  /** Vazias e nulas são puladas; a ordem é a de leitura. */
  lines?: (string | null | undefined)[];
  action?: LoaderAction | null;
}

/** What the curtain shows while it is up. Every field may be null/''. */
export interface LoaderInfo {
  /** which card this load is about — decides the hero AND the flight target */
  subject?: 'truck' | 'map';
  modelName?: string | null;
  modelSubtitle?: string | null;
  modelImage?: string | null;
  logo?: string | null;
  manufacturerName?: string | null;
  envName?: string | null;
  envSubtitle?: string | null;
  envThumb?: string | null;
}

/* ---------------- timing (ms) ----------------
   One table so the choreography can be read at a glance and so the JS-driven
   flight stays in sync with the CSS-driven fades. The outro is sequenced so the
   scrim finishes dissolving at exactly the moment the photo lands: fading it
   earlier would reveal the already-populated badge and make the flight look
   pointless, later would make the photo land on a wall. The matching CSS delay
   lives in loader.css as `scrimOut` (300ms) with a 220ms delay = handoff(60) +
   flight(460) - scrimOut(300). */
const T = {
  curtainIn: 240,   // #ts-loader opacity 0 -> 1
  snap: 120,        // progress fill easing to 100% at the start of the outro
  chromeOut: 180,   // type + logo + meter fading out together
  scrimOut: 300,    // backdrop + vignette dissolving to reveal the 3D scene
  flight: 460,      // the FLIP of the truck photo into the badge
  handoff: 60,      // overlap: how long after the chrome starts fading we launch
  slack: 160,       // grace added to every transition timeout fallback
  watchdog: 1800,   // hard ceiling on finishLoader — the boot must never hang
};

/* ---------------- progress model ----------------
   Raw three.js progress is hostile to a progress bar:
   - it arrives in BURSTS (one xhr event per chunk, then nothing),
   - it can REGRESS, because studio.ts averages three parallel loaders and a late
     starter drags the mean down,
   - and it emits NOTHING AT ALL while FBXLoader parses, which is the single
     longest phase and also blocks the main thread.
   So the public setter only ever moves a *target*; a rAF loop eases the rendered
   value toward it, the target is clamped monotonic, and a creep keeps the target
   drifting while the loader is silent. Do not "simplify" any of the three away:
   without the easing the bar teleports, without the monotonic clamp it walks
   backwards, without the creep it freezes solid for the whole parse. */
const EASE_TAU = 130;         // ms — exponential smoothing constant of the fill
const REAL_CEIL = 0.98;       // real reports stop here; finishLoader owns the last 2%
const CREEP_AFTER = 600;      // ms of silence before the creep takes over
const CREEP_CEIL = 0.9;       // creep asymptote — creep must never reach 1.0
const CREEP_TAU = 5200;       // ms — how lazily the creep approaches the ceiling
const MAX_DT = 200;           // ms — see tick(): the parse stalls frames for seconds

const DEFAULT_LABEL = 'Preparando a cena…';

/* ---------------- module state ---------------- */
let built = false;
let visible = false;
let session = 0;              // bumped by showLoader; guards stale outro callbacks
let finishing: Promise<void> | null = null;   // in-flight outro (re-entrancy guard)

/* Definite-assignment (`!`) rather than `| null`, and the invariant is real:
   initLoader() builds all of these and EVERY public entry point below calls it
   before touching one (showLoader/setLoaderProgress/finishLoader call it
   outright; hideLoader returns early unless `built`). Typing them nullable
   would put ~80 null checks on a value that cannot be null by the time any
   reader runs. */
let el!: HTMLElement;                // #ts-loader
let bgEl!: HTMLElement;
let heroEl!: HTMLElement;            // .ts-load-stage — the element that FLIPs
let photoEl!: HTMLImageElement;
let fallbackEl!: HTMLElement;
let logoEl!: HTMLImageElement;
let brandEl!: HTMLElement;
let nameEl!: HTMLElement;
let subEl!: HTMLElement;
let envEl!: HTMLElement;
let trackEl!: HTMLElement;
let labelEl!: HTMLElement;
let pctEl!: HTMLElement;
let detailEl!: HTMLElement;          // o encaixe de trabalho longo, todo ele
let detailLinesEl!: HTMLElement;
let actionEl!: HTMLButtonElement;
/* O ouvinte do botão é ligado UMA VEZ, no init, e o que troca é este ponteiro:
   religar a cada `setLoaderDetail()` acumularia ouvintes a dez por segundo. */
let actionHandler: (() => void) | null = null;

let raf = 0;
let lastFrame = 0;
let lastReport = 0;
let targetP = 0;              // where the loader says we are
let shownP = 0;               // where the bar is actually drawn
let snapFrom = 0;
let snapAt = 0;               // >0 while the outro is easing the fill to 1
let lastPct = -1;
let lastLabel = '';

const now = () =>
  (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

/* Read the media query fresh on every call rather than keeping a
   MediaQueryList listener around: the curtain is up for seconds at a time, a
   listener would be one more subscription to tear down, and this is called at
   most a handful of times per boot. */
const reducedMotion = () => {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
};

/* ---------------- cancellable waits ----------------
   Every timer and every transition wait registers a canceller here. Tearing the
   curtain down must never leave a promise dangling, so cancel() RESOLVES the
   promise — it never rejects and never drops it. An outro interrupted by
   hideLoader() therefore still runs to completion and finishLoader still
   settles. */
const pending = new Set<() => void>();

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let id: ReturnType<typeof setTimeout>;
    const cancel = () => {
      clearTimeout(id);
      pending.delete(cancel);
      resolve();
    };
    id = setTimeout(cancel, ms);
    pending.add(cancel);
  });
}

/**
 * Resolve when `node` finishes transitioning `prop` — or when `timeoutMs`
 * elapses, whichever comes first.
 *
 * The timeout is not paranoia. `transitionend` is genuinely not guaranteed: it
 * never fires when the transition turns out to be a no-op (identical from/to
 * values), when the element is display:none'd mid-flight, or when the tab is
 * backgrounded, and browsers still drop it under load. A dropped event here
 * would hang finishLoader, which would hang the whole boot.
 */
function transitionDone(
  node: HTMLElement | null, prop: string, timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!node) return resolve();
    let id: ReturnType<typeof setTimeout>;
    const cancel = () => {
      clearTimeout(id);
      node.removeEventListener('transitionend', onEnd);
      node.removeEventListener('transitioncancel', onEnd);
      pending.delete(cancel);
      resolve();
    };
    const onEnd = (ev: TransitionEvent) => {
      if (ev.target === node && (!prop || ev.propertyName === prop)) cancel();
    };
    node.addEventListener('transitionend', onEnd);
    node.addEventListener('transitioncancel', onEnd);
    id = setTimeout(cancel, timeoutMs);
    pending.add(cancel);
  });
}

function cancelPending() {
  for (const cancel of Array.from(pending)) cancel();
  pending.clear();
}

/* ---------------- DOM ----------------
   `make` is core/dom.ts's `el`, imported under this file's own name because the
   module-level `el` below is the #ts-loader node. `initials` comes from there
   too, and that one is load-bearing: ui/selector.ts's badge has to spell the
   same vehicle with the same two letters, or the outro's FLIP reads as a swap
   between two objects rather than as one object moving. */

/** Build the curtain DOM into the studio root. Idempotent. */
export function initLoader() {
  if (built) return;
  built = true;

  el = make('div', 'ts-load hidden');
  el.id = 'ts-loader';
  /* A polite live region: screen readers get the status line and the percentage
     without the curtain ever taking focus. */
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  bgEl = make('div', 'ts-load-bg');
  el.appendChild(bgEl);
  el.appendChild(make('div', 'ts-load-scrim'));

  const inner = make('div', 'ts-load-inner');

  envEl = make('div', 'ts-load-env hidden');
  inner.appendChild(envEl);

  /* The stage is the hero and the thing that flies. Both the photo and the
     lettered placeholder live inside it at inset:0, so the box never changes
     size and the FLIP works identically whether or not the image resolved. */
  heroEl = make('div', 'ts-load-stage');
  photoEl = make('img', 'ts-load-photo');
  photoEl.decoding = 'async';
  photoEl.alt = '';
  /* This failure path is not hypothetical — catalog/catalog.ts's built-in fallback
     catalog ships image: null, and the public assets are generated separately,
     so during integration half the photos simply do not exist. The browser's
     broken-image glyph would read as a bug; a lettered tile reads as
     deliberate, and it is exactly what the badge falls back to. */
  photoEl.addEventListener('error', () => showFallbackTile(true));
  heroEl.appendChild(photoEl);
  fallbackEl = make('span', 'ts-load-fallback hidden');
  fallbackEl.setAttribute('aria-hidden', 'true');
  heroEl.appendChild(fallbackEl);
  inner.appendChild(heroEl);

  /* No secondary motion between the photo and the meter: a drifting lane-dash
     motif used to live here, and next to the progress bar it read as a SECOND,
     indeterminate loading indicator. One progress affordance per screen. */

  const info = make('div', 'ts-load-info');
  logoEl = make('img', 'ts-load-logo hidden');
  logoEl.decoding = 'async';
  logoEl.alt = '';
  logoEl.addEventListener('error', () => {
    logoEl.classList.add('hidden');
    /* Fall back to the manufacturer's name set as a wordmark: the row keeps a
       brand anchor to the left of the type, so the composition stays balanced
       instead of collapsing to a lone model name. */
    brandEl.classList.toggle('hidden', !brandEl.textContent);
  });
  info.appendChild(logoEl);
  brandEl = make('span', 'ts-load-brand hidden');
  info.appendChild(brandEl);

  const type = make('div', 'ts-load-type');
  nameEl = make('div', 'ts-load-name');
  subEl = make('div', 'ts-load-sub hidden');
  type.appendChild(nameEl);
  type.appendChild(subEl);
  info.appendChild(type);
  inner.appendChild(info);

  const meter = make('div', 'ts-load-meter');
  trackEl = make('div', 'ts-load-track');
  trackEl.setAttribute('role', 'progressbar');
  trackEl.setAttribute('aria-valuemin', '0');
  trackEl.setAttribute('aria-valuemax', '100');
  const fill = make('div', 'ts-load-fill');
  fill.appendChild(make('div', 'ts-load-shine'));
  trackEl.appendChild(fill);
  meter.appendChild(trackEl);

  const status = make('div', 'ts-load-status');
  labelEl = make('div', 'ts-load-label');
  pctEl = make('div', 'ts-load-pct');
  /* ⚠️ FORA DO LEITOR DE TELA, e a razão só apareceu quando a gravação passou a
     usar esta cortina (2026-08-15). `#ts-loader` é `role="status"` +
     `aria-live="polite"`, e este texto muda a cada ponto percentual. Num
     carregamento de 5 s isso são ~20 anúncios e passa; num render de vídeo
     offline, que leva MINUTOS, são centenas — o leitor de tela não fala mais
     nada além da porcentagem.
     Nada se perde: a barra logo acima é `role="progressbar"` e carrega o mesmo
     número em `aria-valuenow`, que é a forma que a tecnologia assistiva já sabe
     ler sob demanda em vez de por interrupção. */
  pctEl.setAttribute('aria-hidden', 'true');
  status.appendChild(labelEl);
  status.appendChild(pctEl);
  meter.appendChild(status);

  /* ---- o encaixe de trabalho longo (ver o bloco no topo) ----
     DENTRO do `meter` e não solto no `inner`: é assim que ele herda o fade da
     saída (`.is-out .ts-load-meter`) sem uma segunda regra que alguém teria de
     lembrar de manter em sincronia com aquela. */
  detailEl = make('div', 'ts-load-detail hidden');
  detailLinesEl = make('div', 'ts-load-detail__lines');
  /* ⚠️ FORA DO LEITOR DE TELA, pelo mesmo motivo do `pctEl` logo acima e com
     mais força: estas linhas carregam contadores que mudam DEZ VEZES POR
     SEGUNDO. Numa região viva isso não é informação, é ruído contínuo — e
     afogaria o rótulo de fase, que é a única coisa ali que vale ser falada.
     O botão FICA de fora desta marcação: ele é interativo, e um controle
     escondido da árvore de acessibilidade é um controle que não existe. */
  detailLinesEl.setAttribute('aria-hidden', 'true');
  detailEl.appendChild(detailLinesEl);

  actionEl = make('button', 'ts-load-action hidden');
  actionEl.type = 'button';
  actionEl.addEventListener('click', () => { actionHandler?.(); });
  detailEl.appendChild(actionEl);
  meter.appendChild(detailEl);

  inner.appendChild(meter);

  el.appendChild(inner);

  /* Attached to `root` (.truck-studio-root, position: relative) and NOT to
     document.body: the engine's DOM is a detached subtree that React mounts and
     unmounts, so a body-level curtain would survive the route change and hover
     over the rest of Ankaa. */
  root.appendChild(el);
}

function showFallbackTile(on: boolean) {
  photoEl.classList.toggle('hidden', !!on);
  fallbackEl.classList.toggle('hidden', !on);
}

function setText(node: HTMLElement, value: string | null | undefined) {
  const s = value == null ? '' : String(value).trim();
  /* Só escreve quando MUDA. Era uma atribuição direta, e bastava enquanto quem
     chamava era só `applyInfo()` — uma vez por cortina. `setLoaderDetail()`
     reescreve as linhas dele dez vezes por segundo durante um render de vídeo, e
     um `textContent =` invalida o layout do nó mesmo quando o texto é idêntico.
     `classList.toggle` fica FORA da guarda: ele não muta o DOM quando o
     resultado não muda, e assim uma linha que voltou a ter texto reaparece
     mesmo que o texto seja o mesmo de antes de ela sumir. */
  if (node.textContent !== s) node.textContent = s;
  node.classList.toggle('hidden', !s);
  return !!s;
}

/**
 * Escreve (ou limpa) o encaixe de trabalho longo. Ver o bloco no topo.
 *
 * Chamável a cada tick de progresso: nada aqui aloca nó depois das primeiras
 * chamadas, e nada é escrito duas vezes com o mesmo valor.
 */
export function setLoaderDetail(detail: LoaderDetail | null) {
  if (!built) initLoader();

  const lines = (detail?.lines || []).filter((s): s is string => !!s && !!s.trim());
  /* Os nós de linha são REUTILIZADOS e nunca destruídos: a lista encolhe e
     cresce entre fases (duas linhas renderizando, nenhuma no preparo), e
     recriá-las seria trocar de nó — e de foco, e de leitura — a cada transição. */
  while (detailLinesEl.childElementCount < lines.length) {
    detailLinesEl.appendChild(make('div', 'ts-load-detailline'));
  }
  const nodes = detailLinesEl.children;
  for (let i = 0; i < nodes.length; i++) {
    setText(nodes[i] as HTMLElement, lines[i] ?? '');
  }

  const action = detail?.action || null;
  actionHandler = action ? action.onClick : null;
  if (action) {
    setText(actionEl, action.label);
    const title = action.title || action.label;
    if (actionEl.title !== title) {
      actionEl.title = title;
      actionEl.setAttribute('aria-label', title);
    }
    const off = !!action.disabled;
    if (actionEl.disabled !== off) actionEl.disabled = off;
  }
  actionEl.classList.toggle('hidden', !action);

  const any = lines.length > 0 || !!action;
  detailEl.classList.toggle('hidden', !any);
  /* A classe é do #ts-loader e não do medidor porque quem muda de largura é o
     MEDIDOR, e um elemento não pode reagir à presença de um filho sem `:has()`
     — que é suporte recente demais para uma decisão de layout. */
  el.classList.toggle('has-detail', any);
}

/* CSS url() cannot take a raw string: a quote or a backslash in the path would
   break out of the value. Escape both, keep everything else verbatim. */
function cssUrl(src: string) {
  return 'url("' + String(src).replace(/["\\]/g, '\\$&') + '")';
}

/* Which card this load belongs to: the truck (bottom-left badge) or the scene
   (top-left badge). It decides BOTH what the hero image is and which badge the
   outro flies it into — changing only the scenery and then watching the truck
   photo shrink into the truck card is a straight lie about what happened. */
let subject: 'truck' | 'map' = 'truck';

function applyInfo(info: LoaderInfo) {
  subject = info.subject === 'map' ? 'map' : 'truck';
  const isMap = subject === 'map';
  /* Backdrop: the chosen scene's thumbnail, blurred and darkened almost to
     nothing. It exists so the curtain feels like it belongs to the environment
     the user picked. With no thumb the layer stays empty and the flat --bg plus
     the scrim's radial vignette become the (deliberate) fallback. */
  bgEl.style.backgroundImage = info.envThumb ? cssUrl(info.envThumb) : '';

  const brand = info.manufacturerName ? String(info.manufacturerName).trim() : '';
  /* On a scenery change the hero IS the scenery — the same thumbnail the
     top-left card shows, so the flight lands on a matching image. */
  const heroSrc = isMap ? info.envThumb : info.modelImage;
  const heroAlt = isMap ? info.envName : info.modelName;
  fallbackEl.textContent = initials(heroAlt || brand);
  if (heroSrc) {
    showFallbackTile(false);
    photoEl.alt = heroAlt ? String(heroAlt) : '';
    photoEl.src = heroSrc;
  } else {
    showFallbackTile(true);
    photoEl.removeAttribute('src');
  }

  brandEl.textContent = brand;
  /* The manufacturer logo belongs to the truck. On a scenery change it would be
     labelling an image it has nothing to do with. */
  if (!isMap && info.logo) {
    logoEl.classList.remove('hidden');
    logoEl.alt = brand;
    logoEl.src = info.logo;
    brandEl.classList.add('hidden');
  } else {
    logoEl.classList.add('hidden');
    logoEl.removeAttribute('src');
    brandEl.classList.toggle('hidden', !brand);
  }

  /* Every field is nullable, so the headline degrades down a chain instead of
     rendering an empty box. */
  if (isMap) {
    nameEl.textContent = String(info.envName || 'Montando a cena');
    setText(subEl, info.envSubtitle);
    setText(envEl, 'Cenário');
  } else {
    nameEl.textContent = String(info.modelName || brand || 'Montando a cena');
    setText(subEl, info.modelSubtitle);
    setText(envEl, info.envName ? 'Cenário · ' + info.envName : '');
  }
}

/* ---------------- the rAF loop ---------------- */
function paint() {
  el.style.setProperty('--ts-p', shownP.toFixed(4));
  const pct = Math.round(shownP * 100);
  if (pct === lastPct) return;      // only touch the DOM when a digit changes
  lastPct = pct;
  pctEl.textContent = pct + '%';
  trackEl.setAttribute('aria-valuenow', String(pct));
}

function tick(t: number) {
  raf = requestAnimationFrame(tick);

  /* The FBX parse blocks the main thread for seconds, so dt can arrive as 3000+.
     Feeding that straight into the exponential ease would snap the bar onto the
     target the instant frames resume, which reads as a glitch. Clamping dt turns
     the catch-up into a fast but visible sweep instead. */
  const dt = Math.min(t - lastFrame, MAX_DT);
  lastFrame = t;
  if (dt <= 0) return;

  if (snapAt > 0) {
    /* Outro: a deterministic 120 ms ease-out to 100 %, bypassing the smoothing
       above — the user has to SEE the bar complete, not asymptote toward it. */
    const k = clamp01((t - snapAt) / T.snap);
    shownP = snapFrom + (1 - snapFrom) * (1 - Math.pow(1 - k, 3));
    paint();
    return;
  }

  /* Creep. FBXLoader emits no progress events while it parses and the HDRI
     decode is likewise silent, so without this the bar sits frozen through the
     longest, most anxious part of the wait. The creep is asymptotic toward
     CREEP_CEIL and can never touch 1.0 — only finishLoader completes the bar,
     because only studio.ts knows the scene is actually framed and drawable. */
  if (t - lastReport > CREEP_AFTER && targetP < CREEP_CEIL) {
    targetP += (CREEP_CEIL - targetP) * (1 - Math.exp(-dt / CREEP_TAU));
  }

  /* Time-based exponential smoothing rather than the usual
     `v += (target - v) * 0.12`: the constant-per-frame form silently changes
     speed with the refresh rate and crawls after a long stall. */
  shownP += (targetP - shownP) * (1 - Math.exp(-dt / EASE_TAU));
  if (shownP > targetP) shownP = targetP;
  paint();
}

function startTicker() {
  if (raf) return;
  lastFrame = now();
  lastReport = lastFrame;
  raf = requestAnimationFrame(tick);
}

function stopTicker() {
  if (!raf) return;
  cancelAnimationFrame(raf);
  raf = 0;
}

/* ---------------- public API ---------------- */

/**
 * Fade the curtain in, showing what is being loaded. Resets progress to 0.
 * @param {{modelName?:string, modelSubtitle?:string, modelImage?:string,
 *          logo?:string, manufacturerName?:string, envName?:string,
 *          envThumb?:string}} [info] every field may be null/''.
 */
export function showLoader(info?: LoaderInfo) {
  initLoader();
  session++;
  cancelPending();          // a previous outro, if any, settles right here
  finishing = null;

  applyInfo(info || {});

  targetP = 0;
  shownP = 0;
  snapAt = 0;
  snapFrom = 0;
  lastPct = -1;
  lastLabel = DEFAULT_LABEL;
  labelEl.textContent = DEFAULT_LABEL;
  pctEl.textContent = '0%';
  trackEl.setAttribute('aria-valuenow', '0');
  el.style.setProperty('--ts-p', '0');

  /* O encaixe de trabalho longo NÃO é herdado. Uma cortina nova é outro
     trabalho: as linhas e o botão do anterior apareceriam por um instante
     descrevendo — e oferecendo cancelar — algo que já acabou. */
  setLoaderDetail(null);

  heroEl.style.cssText = '';    // wipe any transform/transition left by an outro
  el.classList.remove('is-done', 'is-out', 'is-flying');
  el.classList.remove('hidden');

  /* One forced reflow, on purpose: the browser needs a resolved opacity-0
     starting style before .is-in flips it to 1, and the keyframes are gated on
     .is-in so this is also what replays the intro on a second show. */
  void el.offsetWidth;
  el.classList.add('is-in');

  visible = true;
  startTicker();
}

/**
 * Report real progress. Clamped to 0..1 and monotonic — never moves backwards.
 * @param {number} p
 * @param {string} [label] optional pt-BR status line ('Carregando cabine…')
 */
export function setLoaderProgress(p: number, label?: string) {
  if (!built) initLoader();

  if (typeof label === 'string' && label && label !== lastLabel) {
    lastLabel = label;
    labelEl.textContent = label;
  }

  const v = Number(p);
  if (!Number.isFinite(v)) return;

  /* Any report at all means the pipeline is alive, so the creep stands down —
     even a report LOWER than what we already show. */
  lastReport = now();
  if (snapAt > 0) return;                 // the outro owns the bar from here on

  /* Monotonic: studio.ts averages the HDRI, the cab and the trailer, so a loader
     that starts late drops the mean. A bar that walks backwards reads as a bug
     even when the underlying number is honest.
     The REAL_CEIL cap is deliberate too: after the bytes land there is still
     framing and shader compilation to do, and a bar parked at 100 % during that
     looks like a hang. The last 2 % belongs to finishLoader. */
  const next = Math.min(clamp01(v), REAL_CEIL);
  if (next > targetP) targetP = next;
}

/**
 * Tear the curtain down instantly, no animation (error paths, route unmount).
 * Safe to call at any time, including from inside an outro.
 */
export function hideLoader() {
  if (!built) return;
  visible = false;
  stopTicker();
  cancelPending();
  /* Solta o `onClick` junto com a cortina: ele é um fechamento sobre o estado de
     quem a levantou, e mantê-lo vivo depois disso é segurar aquele estado. */
  setLoaderDetail(null);
  el.classList.add('hidden');
  el.classList.remove('is-in', 'is-done', 'is-out', 'is-flying');
  heroEl.style.cssText = '';
  el.style.setProperty('--ts-p', '0');
  snapAt = 0;
}

/* ---------------- the outro ---------------- */

/**
 * Measure the badge's media box — the flight target.
 *
 * ui/selector.ts fills and un-hides #ts-badge before the overlay closes, so by the
 * time we get here it has a real layout box sitting behind our scrim; we just
 * read it. We deliberately do NOT touch its visibility: it is another agent's
 * element, and hiding it even for one frame would cancel its entry animation.
 * The zero-rect guard below is the exceptional path (badge missing, template
 * changed, layout not settled) and degrades to a plain fade.
 */
function badgeMediaRect() {
  const isMap = subject === 'map';
  const badge = $opt(isMap ? 'ts-mapbadge' : 'ts-badge');
  if (!badge) return null;
  const media = badge.querySelector(isMap ? '.ts-mapbadge__media' : '.ts-badge__media');
  if (!media) return null;
  const rect = media.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1 ? rect : null;
}

/**
 * FLIP the hero into the badge. First / Last / Invert / Play, driven by a SINGLE
 * transform — animating width/left/top instead would relayout the whole column
 * on every frame of a 460 ms animation.
 * @returns {Promise<boolean>} false when the flight was not possible
 */
async function flyHero() {
  /* Branch reduced motion in JS as well as in CSS: a transform driven from
     JavaScript is invisible to a CSS motion override, so the media query alone
     would not stop the flight. */
  if (reducedMotion()) return false;

  const last = badgeMediaRect();
  if (!last) return false;
  const first = heroEl.getBoundingClientRect();
  if (!(first.width > 1 && first.height > 1)) return false;

  /* Uniform `min` scale so the hero lands fully inside the badge's media box;
     the tail-end opacity fade then covers the fact that the badge's own <img>
     uses object-fit: cover while ours uses contain. */
  const s = Math.min(last.width / first.width, last.height / first.height);
  const dx = (last.left + last.width / 2) - (first.left + first.width / 2);
  const dy = (last.top + last.height / 2) - (first.top + first.height / 2);

  /* The intro keyframe fills `both`. It animates the individual `translate` and
     `scale` properties rather than `transform` precisely so it cannot fight this
     one, but if the outro arrives while the intro is still RUNNING those held
     values would still offset the flight — so cancel it outright. */
  heroEl.style.animation = 'none';
  heroEl.style.transformOrigin = 'center center';
  heroEl.style.transition =
    'transform ' + T.flight + 'ms cubic-bezier(0.4, 0, 0.2, 1), ' +
    'opacity 200ms linear ' + (T.flight - 200) + 'ms';
  el.classList.add('is-flying');
  void heroEl.offsetWidth;                     // commit the pre-flight style

  heroEl.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + s + ')';
  heroEl.style.opacity = '0';

  await transitionDone(heroEl, 'transform', T.flight + T.slack);
  return true;
}

/** No badge to fly to (or reduced motion): fade, with a whisper of scale. */
async function fadeHero() {
  const soft = reducedMotion();
  heroEl.style.animation = 'none';
  heroEl.style.transition = soft
    ? 'opacity ' + T.flight + 'ms ease'
    : 'transform ' + T.flight + 'ms cubic-bezier(0.4, 0, 0.2, 1), opacity ' + T.flight + 'ms ease';
  void heroEl.offsetWidth;
  if (!soft) heroEl.style.transform = 'scale(1.02)';
  heroEl.style.opacity = '0';
  await transitionDone(heroEl, 'opacity', T.flight + T.slack);
}

async function playOutro(wantFly: boolean) {
  if (!built || !visible) return;

  // 1. The bar completes and the shimmer stops.
  snapFrom = shownP;
  snapAt = now();
  targetP = 1;
  el.classList.add('is-done');
  await sleep(T.snap);
  stopTicker();                       // nothing left to animate; free the loop
  snapAt = 0;
  shownP = 1;
  el.style.setProperty('--ts-p', '1');
  if (lastPct !== 100) {
    lastPct = 100;
    pctEl.textContent = '100%';
    trackEl.setAttribute('aria-valuenow', '100');
  }

  /* 2. Type, logo and meter fade out together (180 ms). The
     backdrop and vignette start dissolving 220 ms later so they finish at the
     same instant the hero lands on the badge — see the note on T. */
  el.classList.add('is-out');
  await sleep(T.handoff);

  // 3. The hero either flies into the badge or fades in place. Both take
  //    T.flight, so the scrim's landing beat holds either way.
  const flew = wantFly ? await flyHero() : false;
  if (!flew) await fadeHero();
}

/**
 * Play the outro and resolve when the curtain is gone.
 * @param {{flyToBadge?: boolean}} [opts] flyToBadge defaults to true.
 * @returns {Promise<void>} always resolves — never rejects, never hangs.
 */
export function finishLoader(opts?: { flyToBadge?: boolean }): Promise<void> {
  if (finishing) return finishing;              // re-entrant: hand back the same promise
  if (!built || !visible) {
    /* Never shown, or already torn down. Still tidy up, still resolve — the
       caller awaits this unconditionally. */
    hideLoader();
    return Promise.resolve();
  }

  const wantFly = !opts || opts.flyToBadge !== false;
  const mine = session;

  const run = playOutro(wantFly).catch((err: unknown) => {
    console.error('[truck-studio] loader outro failed', err);
  });

  /* Belt and braces. Every await inside playOutro already has its own timeout
     fallback, but one dropped promise anywhere in there would hang the whole
     boot sequence — far worse than a curtain that vanishes 200 ms early.
     Whichever settles first, the curtain comes down and we resolve. */
  const p: Promise<void> = Promise.race([run, sleep(T.watchdog)]).then(() => {
    /* Only tear down if no showLoader() ran in the meantime, otherwise a stale
       outro would hide a curtain that was just raised again. */
    if (session === mine) hideLoader();
    if (finishing === p) finishing = null;
  });

  finishing = p;
  return p;
}
