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
   mountStudio()/unmountStudio() (main.js). It is never destroyed: the WebGL
   context, the loaded models (~76 MB) and the fabric canvases survive a route
   change, so coming back to the page is instant.

   `$` is scoped to the container, so studio ids can never hit Ankaa's DOM. */
import { STUDIO_HTML } from './template.js';

/* Everything under public/truck-studio/ — models, meta JSON, draco decoder. */
export const ASSET_BASE = '/truck-studio/';

export const root = document.createElement('div');
root.className = 'truck-studio-root';
root.setAttribute('data-truck-studio', '');
root.innerHTML = STUDIO_HTML;

export const $ = id => root.querySelector('#' + id);
export const $$ = sel => Array.from(root.querySelectorAll(sel));

/** True while the studio is attached to the page (i.e. has a layout box). */
export const isMounted = () => root.isConnected;
