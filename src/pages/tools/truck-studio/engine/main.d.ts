/* Types for the vanilla-JS engine entry point (engine/main.js).
   The engine is plain ES modules on purpose — it is a direct port of the
   standalone truck-studio app, and keeping it untyped JS lets upstream changes
   there apply here unchanged. Only its public surface is declared. */

/** Attach the studio to `host`, start rendering, and boot it on first mount. */
export declare function mountStudio(host: HTMLElement): Promise<void>;

/** Stop rendering and detach the studio, keeping GPU/model state alive. */
export declare function unmountStudio(): void;
