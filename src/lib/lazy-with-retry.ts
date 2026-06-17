import { lazy, type ComponentType } from "react";
import { isChunkLoadError, reloadForStaleChunk } from "./chunk-reload";

/**
 * Drop-in replacement for React.lazy that recovers from a stale-chunk import
 * failure (common right after a deploy, when a still-open tab requests chunk
 * hashes that no longer exist) by reloading the document ONCE to pick up the new
 * index.html / chunk map. Guarded against reload loops via sessionStorage.
 *
 * Usage: `import { lazyWithRetry as lazy } from "@/lib/lazy-with-retry";` —
 * existing `lazy(() => import(...))` call sites work unchanged.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err)) {
        reloadForStaleChunk("lazy-import");
      }
      // Re-throw so the nearest ErrorBoundary can render a fallback if the
      // reload is suppressed (e.g. within the reload-guard window).
      throw err;
    }
  });
}
