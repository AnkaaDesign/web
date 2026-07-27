// =====================================================
// Attention system — surface presence
// =====================================================
//
// "Is the user already looking at a surface that shows this entity type's records?"
//
// ONE authority, two consumers:
//   • the sidebar — an entity whose queue is on screen contributes NO nav indicator. The
//     nav exists to LEAD you to unresolved work; pointing at the page you are already on
//     is noise, and it is worse than noise when it lands on the ACTIVE entry, whose own
//     highlight swallows the ring (which is why the Recorte entry looked dead on the
//     Recorte page while Cronograma lit up on the Agenda page — same rule, different
//     number of nav paths per entity).
//   • the engine  — no BIP for an entity you are looking at. The visual ring stays; only
//     the sound stops. A warehouse operator staring at the cut queue does not need to be
//     beeped at every 60s about the row in front of them.
//
// Two things feed it, both entity-agnostic:
//   • ROUTE     — the pathname is inside one of the entity's `navPaths` (list root or any
//                 sub-route, so drilling into a record stays quiet too). Pushed by
//                 `AttentionProvider`, the one place that already sits inside the router.
//   • COMPONENT — a surface rendered somewhere else (the dashboard "Fila de Corte" widget)
//                 declares itself with `useAttentionSurface(type)`. Refcounted, so several
//                 instances on one board behave like one.
//
// This replaces the cut-only `isCutPage()` + `cutQueueMountCount` pair that used to live in
// `use-nav-activity-alert.ts` — and, unlike it, arms no lingering snooze: step off the
// surface and the signal is exactly as it was.

import { useEffect, useSyncExternalStore } from "react";

import { setActiveSurfaces } from "./engine";
import type { AttentionEntityType } from "./types";

/** Refcount of mounted component surfaces per type. */
const mounted = new Map<AttentionEntityType, number>();
/** Types the current route is a surface for. */
let routeTypes: ReadonlySet<AttentionEntityType> = new Set();

const listeners = new Set<() => void>();
let snapshot: ReadonlySet<AttentionEntityType> = new Set();

function republish(): void {
  const next = new Set<AttentionEntityType>(routeTypes);
  for (const [type, n] of mounted) if (n > 0) next.add(type);
  // useSyncExternalStore needs a stable reference when nothing changed.
  if (next.size === snapshot.size && [...next].every((t) => snapshot.has(t))) return;
  snapshot = next;
  setActiveSurfaces(next); // the engine gates its bip on this
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Route-derived surfaces. Called by `AttentionProvider` on every navigation; not a public
 * concern of any page.
 */
export function setRouteSurfaces(types: ReadonlyArray<AttentionEntityType>): void {
  const next = new Set(types);
  if (next.size === routeTypes.size && [...next].every((t) => routeTypes.has(t))) return;
  routeTypes = next;
  republish();
}

/**
 * Declare that this component is a surface showing `type`'s records. While it is mounted,
 * nav entries for that entity stay quiet and the entity does not bip.
 *
 * `active` gates it so the hook can stay unconditional in a generic component that only
 * sometimes participates — `DetailPage` calls it on every detail page in the app, and an
 * ungated call there would have every unrelated record (a customer, an item) silently
 * claiming to be a TASK surface.
 */
export function useAttentionSurface(type: AttentionEntityType, active = true): void {
  useEffect(() => {
    if (!active) return;
    mounted.set(type, (mounted.get(type) ?? 0) + 1);
    republish();
    return () => {
      mounted.set(type, Math.max(0, (mounted.get(type) ?? 0) - 1));
      republish();
    };
  }, [type, active]);
}

/** Entity types with an active surface right now (route or mounted component). */
export function useAttentionSurfaceTypes(): ReadonlySet<AttentionEntityType> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
