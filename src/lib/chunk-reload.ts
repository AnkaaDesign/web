/**
 * Stale-chunk recovery after a deploy.
 *
 * The web app is fully code-split with content-hashed chunk filenames (see
 * vite.config.ts). After a new deploy, a tab still running the OLD build holds
 * references to chunk URLs that no longer exist on the server. The first
 * navigation to a not-yet-loaded route then fails the dynamic `import()` with a
 * ChunkLoadError / "Failed to fetch dynamically imported module", and because
 * the route <Suspense> has no error fallback, the subtree unmounts to a BLANK
 * page (the user had to press the browser reload button manually).
 *
 * The fix: detect that specific failure and reload the document ONCE so the
 * browser fetches the fresh index.html and resolves to the new chunk hashes.
 * A timestamp guard prevents a reload loop if a chunk is genuinely missing.
 */

const RELOAD_GUARD_KEY = "ankaa:chunk-reload-ts";
const RELOAD_WINDOW_MS = 10_000;

const CHUNK_ERROR_RE =
  /dynamically imported module|importing a module script failed|chunkloaderror|error loading dynamically imported|failed to fetch dynamically imported|loading chunk \d+ failed|loading css chunk/i;

/** True when an error/message looks like a failed dynamic import of a stale chunk. */
export function isChunkLoadError(input: unknown): boolean {
  const msg =
    typeof input === "string"
      ? input
      : ((input as any)?.message ?? String((input as any) ?? ""));
  return CHUNK_ERROR_RE.test(msg);
}

/** Reload the page at most once per RELOAD_WINDOW_MS (prevents reload loops). */
export function reloadForStaleChunk(reason: string): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable -> fall through and reload anyway.
  }
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[chunk-reload] reloading to recover stale chunks:", reason);
  }
  window.location.reload();
}

let installed = false;

/** Install global listeners that auto-recover from stale-chunk navigation failures. */
export function installChunkReloadHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Vite emits this when a lazy import()'s module preload 404s after a deploy.
  window.addEventListener(
    "vite:preloadError",
    ((event: Event) => {
      event.preventDefault(); // stop Vite from throwing -> we handle recovery
      reloadForStaleChunk("vite:preloadError");
    }) as EventListener,
  );

  // The raw promise rejection, if vite:preloadError didn't fire.
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event?.reason)) {
      reloadForStaleChunk("unhandledrejection");
    }
  });

  // React may re-throw a rejected lazy() import synchronously during render;
  // with no route ErrorBoundary it bubbles to window 'error'.
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event?.error) || isChunkLoadError(event?.message)) {
      reloadForStaleChunk("window.error");
    }
  });
}
