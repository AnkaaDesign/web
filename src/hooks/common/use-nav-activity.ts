// =====================================================
// Navigation "new activity" indicators (blinking guide)
// =====================================================
//
// Abstract, reusable signal layer that tells the sidebar WHICH navigation entries
// currently have pending activity the user should be nudged toward. The sidebar
// turns each signal into a subtle blinking red border that "leads" the user inward:
// the domain blinks first, and once it is opened the blink hops to the relevant
// subdomain, and so on until the target page itself.
//
// Keying is by ROUTE PATH (e.g. "/producao/recorte"), not menu id, because the same
// logical domain is duplicated per role in the menu tree (recorte vs recorte-plotting,
// producao vs producao-production-manager). Path is the stable, role-agnostic key.
//
// ---------------------------------------------------------------------------
// THE NAV IS A PROJECTION OF THE ATTENTION ENGINE — NOTHING ELSE.
// ---------------------------------------------------------------------------
// There is exactly ONE source here, and it iterates `ATTENTION_ACTIVE_TYPES`. Adding a
// blinking indicator for a new entity means declaring a descriptor in
// `lib/attention/entities.ts` and writing a rule — this file does not change.
//
// It used to be two hooks: the attention engine for TASK, plus a bespoke
// `useWarehousePendingCutsActivity` that ran its own `count(status=PENDING)` poll with
// `armed: true` hardcoded and was then gated by a second blink state machine
// (`use-nav-activity-alert.ts`, now deleted) that removed the cut path from the blink set
// entirely whenever the user was anywhere under /producao/recorte. So the cut nav and the
// cut rows were driven by different clocks with different vocabularies, and opening one
// cut silenced the nav for every other pending cut. The engine already computed correct
// per-type counts; nobody consumed them.
//
// The vocabulary every surface now shares:
//   armed   → BLINK   (a row is actively blinking somewhere)
//   resting → STATIC  (viewed / in cooldown, still unresolved)
//   absent  → nothing (no rule matches)
// A resting entity is never hidden — that is what let the nav contradict the rows.

import { useMemo } from "react";

import {
  useAttentionVersion,
  getAttentionSnapshot,
  useAttentionSurfaceTypes,
  attentionEntityDescriptor,
  ATTENTION_ACTIVE_TYPES,
} from "@/lib/attention";

/** A single "this nav entry needs attention" signal. */
export interface NavActivityHint {
  /** Route path of the nav entry that has pending activity (e.g. "/producao/recorte"). */
  path: string;
  /** How many pending items (optional; reserved for future count badges). */
  count?: number;
  /** Severity of the underlying attention(s) — drives the nav blink COLOR (red for
   * `harsh`/urgent, amber for `soft`/routine). Defaults to `harsh` when omitted. */
  tone?: "harsh" | "soft";
  /** Is anything ACTIVELY blinking (armed) vs merely resting? Armed → the nav BLINKS;
   * resting-only → the nav shows a STATIC border (mirrors the row). Defaults to `true`. */
  armed?: boolean;
}

/**
 * Attention engine → nav indicators, for every entity type that has rules.
 *
 * ONE source: `getAttentionSnapshot()`. The nav used to merge the engine's snapshot with a
 * separate `{count, armed, harsh}` triple polled from the server, each side deciding for itself
 * what "armed" meant — the engine from its ack store, the server from `AttentionAck` rows. Two
 * implementations of one concept is how the nav and the rows kept contradicting each other. The
 * server now reports which records MATCH and nothing more (see `use-attention-summary.ts`);
 * those become ordinary cycles in the engine, so this projection covers loaded and unloaded
 * records alike without knowing the difference.
 *
 * An entity whose records are ON SCREEN contributes NOTHING. Not a dimmed indicator — none.
 * The rows themselves are the signal at full fidelity, and an indicator pointing at the page
 * you are on is noise. It is also unrenderable in the common case: that path is the ACTIVE
 * nav entry, whose highlight covers the ring — which is why the Recorte entry appeared dead
 * on the Recorte page while, on the Agenda page, the very same rule lit up Cronograma
 * (tasks have two nav paths, so the non-active sibling stayed visible). One rule, two
 * different-looking bugs. Off the surface, the indicator returns exactly as it was — there
 * is no lingering snooze.
 */
function useAttentionNavActivity(): NavActivityHint[] {
  useAttentionVersion(); // re-render whenever attention state flips
  const snapshot = getAttentionSnapshot();
  const surfaces = useAttentionSurfaceTypes();

  const hints: NavActivityHint[] = [];
  for (const type of ATTENTION_ACTIVE_TYPES) {
    if (surfaces.has(type)) continue; // already looking at them
    const descriptor = attentionEntityDescriptor(type);
    if (!descriptor || descriptor.navPaths.length === 0) continue;

    const state = snapshot.get(type);
    if (!state || state.count <= 0) continue;

    const tone: "harsh" | "soft" = state.harsh ? "harsh" : "soft";
    for (const path of descriptor.navPaths) hints.push({ path, count: state.count, tone, armed: state.armed });
  }
  return hints;
}

/**
 * An activity source is a hook returning zero or more hints. It owns its own gating
 * (role checks, feature flags) and its own data fetching, returning `[]` when there
 * is nothing to signal (including when the current user shouldn't see it at all).
 * Sources MUST be unconditional hooks — they are called in a fixed order every render.
 *
 * Kept as a registry so a future signal that genuinely ISN'T attention-rule-shaped can be
 * added here. Anything that IS should become a rule + descriptor instead.
 */
export type NavActivitySource = () => NavActivityHint[];

const NAV_ACTIVITY_SOURCES: NavActivitySource[] = [useAttentionNavActivity];

export interface NavActivity {
  /** Route paths that currently have pending activity. */
  paths: Set<string>;
  /** Pending count per path (0 when a source didn't report one). */
  counts: Map<string, number>;
  /** Severity per path (harsh wins if a path has mixed sources) — drives blink color. */
  tones: Map<string, "harsh" | "soft">;
  /** Paths that are ARMED (blinking) vs resting — a path here blinks; a path in `paths`
   * but NOT here shows a static border (mirrors a viewed/resting row). */
  armedPaths: Set<string>;
}

/**
 * Aggregate every registered activity source into a single, memoized snapshot the
 * sidebar consumes. Safe to call once (in the always-mounted sidebar).
 */
export function useNavActivity(): NavActivity {
  // Call each source hook in a stable order (module-level constant array).
  const hints = NAV_ACTIVITY_SOURCES.map((useSource) => useSource());

  // Stable dependency key so the memo only recomputes when a signal actually changes.
  const signature = hints
    .flat()
    .map((h) => `${h.path}:${h.count ?? 0}:${h.tone ?? "harsh"}:${h.armed !== false ? 1 : 0}`)
    .sort()
    .join("|");

  return useMemo(() => {
    const paths = new Set<string>();
    const counts = new Map<string, number>();
    const tones = new Map<string, "harsh" | "soft">();
    const armedPaths = new Set<string>();
    for (const hint of hints.flat()) {
      paths.add(hint.path);
      counts.set(hint.path, (counts.get(hint.path) ?? 0) + (hint.count ?? 0));
      const tone = hint.tone ?? "harsh";
      if (tone === "harsh" || !tones.has(hint.path)) tones.set(hint.path, tone);
      if (hint.armed !== false) armedPaths.add(hint.path);
    }
    return { paths, counts, tones, armedPaths };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
