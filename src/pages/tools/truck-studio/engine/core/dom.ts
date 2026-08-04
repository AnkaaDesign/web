/* Ankaa integration layer: the engine owns its own DOM subtree.
   ---------------------------------------------------------------------------
   In the standalone app the markup came from index.html and every module could
   reach it with document.getElementById at import time. Inside a React SPA
   neither of those holds: the page is mounted/unmounted by the router, and the
   ids ("status", "loading", "sidebar", …) would collide with the rest of Ankaa.

   So: this module builds the studio's markup ONCE, into a detached container,
   at module-evaluation time. Because every other engine module imports `$` from
   here, ES module evaluation order guarantees this body runs first — their
   top-level `$('fabric-left')`-style lookups keep working untouched.

   The container is then appended to / removed from the React host element by
   mountStudio()/unmountStudio() (../studio.ts). It is never destroyed: the WebGL
   context, the loaded models (~76 MB) and the fabric canvases survive a route
   change, so coming back to the page is instant.

   `$` is scoped to the container, so studio ids can never hit Ankaa's DOM.

   This module is also where the engine's SHARED SCRAPS live — el(), initials(),
   errText(), clamp01(), num(). None of them is about the container above; they
   are here because this is the one module every other engine module already
   imports, and because each of them had drifted into three to seven private
   copies that were no longer byte-identical (loader.ts's clamp01 let NaN
   through, paint.ts's did not). One definition is what stops the copies from
   disagreeing again. */
import { STUDIO_HTML } from './template';

export const root = document.createElement('div');
root.className = 'truck-studio-root';
root.setAttribute('data-truck-studio', '');
root.innerHTML = STUDIO_HTML;

/**
 * Look up one of the studio's OWN elements by id.
 *
 * Non-null by contract, and the contract is real: STUDIO_HTML is a module
 * constant that is parsed into `root` above, at module-evaluation time, before
 * any other engine module has run. Every id `$` is called with is in that
 * markup, so a null here is a template edit that dropped an element — a
 * programming error, not a runtime condition to branch on. Typing it nullable
 * would put ~300 meaningless `!` or `?.` at the call sites and hide the two
 * places where absence IS a real possibility; those use `$opt` instead.
 *
 * The type parameter is how a caller says which element it expects:
 * `$<HTMLInputElement>('paint-color').value`.
 */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  root.querySelector<T>('#' + id) as T;

/**
 * Same lookup, but for ids that are injected at RUNTIME rather than shipped in
 * STUDIO_HTML (the two selector badges) or that a template edit may legitimately
 * remove (#canvas-holder). These callers degrade instead of throwing, so they
 * get the honest nullable type.
 */
export const $opt = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  root.querySelector<T>('#' + id);

export const $$ = <T extends HTMLElement = HTMLElement>(sel: string): T[] =>
  Array.from(root.querySelectorAll<T>(sel));

/**
 * The element an event fired on, typed.
 *
 * `Event.target` is `EventTarget | null` because an event can be dispatched at a
 * Window, a Document or an XHR. Every listener in this engine is attached to a
 * concrete element inside `root` and reads that same element's own value, so
 * naming the type here is a statement about where the listener lives — not a
 * hope. `evCurrent` is the same for the element the listener is BOUND to, which
 * is what you want whenever the handler also mutates it (a toggle button
 * restyling itself).
 */
export const evTarget = <T extends HTMLElement = HTMLElement>(e: Event): T => e.target as T;
export const evCurrent = <T extends HTMLElement = HTMLElement>(e: Event): T => e.currentTarget as T;

/** True while the studio is attached to the page (i.e. has a layout box). */
export const isMounted = () => root.isConnected;

/* ---------------- shared scraps ----------------
   Small helpers with no home of their own. Each of these existed in two or more
   engine modules; see the module header for why they now live here. */

/**
 * Build an element. House style everywhere in the engine's UI is to construct
 * the DOM in JS rather than to parse HTML strings, so this three-argument shape
 * covers the overwhelming majority of the calls: tag, class list, text.
 *
 * `text != null` rather than a truthiness test, so `el('span', 'x', '')` still
 * clears the node instead of leaving it untouched.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Graceful degradation for a missing photo: "Volvo FH16 750" → "VF".
 *
 * Better than a broken-image icon, and it still identifies the card. It MUST be
 * one function: ui/loader.ts's curtain and ui/selector.ts's badge show the
 * placeholder for the same vehicle at the two ends of the outro's FLIP, and two
 * implementations that drifted apart would make the flight read as a swap
 * between two different objects rather than as one object moving.
 */
export function initials(name: string | null | undefined) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '🚛';
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** Readable message out of a thrown value — `catch (e)` is `unknown` under strict. */
export const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Clamp to 0..1, coercing first.
 *
 * `+v || 0` is what makes NaN and a non-numeric input land on 0 instead of
 * propagating: a NaN progress value reaching a CSS custom property drops the
 * whole declaration, and a NaN uniform blacks out a shader.
 */
export const clamp01 = (v: number) => Math.min(1, Math.max(0, +v || 0));

/** A finite number out of anything, or the fallback. */
export const num = (v: unknown, fallback: number) =>
  (Number.isFinite(+(v as number)) ? +(v as number) : fallback);
