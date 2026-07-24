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
// Adding a new blinking indicator later is a one-liner: write a small hook that
// returns the target route path(s) when there is something to act on, then register
// it in NAV_ACTIVITY_SOURCES below. Everything downstream (trail resolution, the
// blink animation, the collapsed flyout) is generic and keyed by route path, so it
// works for any role/section without touching the sidebar.
//
// Keying is by ROUTE PATH (e.g. "/producao/recorte"), not menu id, because the same
// logical domain is duplicated per role in the menu tree (recorte vs recorte-plotting,
// producao vs producao-production-manager). Path is the stable, role-agnostic key.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { routes, SECTOR_PRIVILEGES, CUT_STATUS } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { canAccessAnyPrivilege } from "@/utils/privilege";
import { useCuts } from "@/hooks/production/use-cut";
import { useAttentionVersion, getAttentionCountsByType, getAttentionSeverityByType, getAttentionArmedByType } from "@/lib/attention";
import { apiClient } from "@/api-client/axiosClient";

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
 * An activity source is a hook returning zero or more hints. It owns its own gating
 * (role checks, feature flags) and its own data fetching, returning `[]` when there
 * is nothing to signal (including when the current user shouldn't see it at all).
 * Sources MUST be unconditional hooks — they are called in a fixed order every render.
 */
export type NavActivitySource = () => NavActivityHint[];

/**
 * Warehouse: a cut exists that has not started yet (status PENDING). Blinks the path
 * to the "Recorte" (cuts) page so the warehouse operator is guided there to start it.
 * Gated to WAREHOUSE (ADMIN inherits access), and only fetches for those users.
 */
function useWarehousePendingCutsActivity(): NavActivityHint[] {
  const { user } = useAuth();

  const userPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const enabled = !!userPrivilege && canAccessAnyPrivilege(userPrivilege, [SECTOR_PRIVILEGES.WAREHOUSE]);

  // Minimal payload: we only need the total count of PENDING cuts, not the rows.
  const { data } = useCuts(
    { status: [CUT_STATUS.PENDING], limit: 1 } as never,
    {
      enabled,
      staleTime: 1000 * 30, // 30s — lets an on-focus refetch actually fire inside the poll window
      refetchInterval: enabled ? 1000 * 60 : false, // re-poll every 1 min so a new cut nags others promptly
      refetchOnWindowFocus: true,
    } as never,
  );

  const count = (data as { meta?: { totalRecords?: number } } | undefined)?.meta?.totalRecords ?? 0;
  if (!enabled || count <= 0) return [];
  // Pending cuts are urgent → red, and always "armed" (a pending cut is actionable).
  return [{ path: routes.production.cutting.root, count, tone: "harsh", armed: true }];
}

/**
 * Server-side attention summary (GET /attention/summary) — the global count, not
 * just what this tab happens to have loaded. Polled independently of any task list
 * (same lightweight pattern as `useWarehousePendingCutsActivity`'s count-only cut
 * query) so the Agenda/Cronograma nav entries can blink from ANYWHERE, including
 * pages — like the Produção dashboard — that never register a single task with the
 * local engine. See api/docs/attention-server-side.md §6.
 */
function useAttentionSummary(): { count: number; armed: boolean; harsh: boolean } {
  const { user } = useAuth();
  const userPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;
  const enabled = !!userPrivilege && canAccessAnyPrivilege(userPrivilege, [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]);

  const { data } = useQuery({
    queryKey: ["attention-summary"],
    queryFn: async () => {
      const res = await apiClient.get("/attention/summary");
      return ((res as { data?: { counts?: { TASK?: number }; armed?: { TASK?: boolean }; harsh?: { TASK?: boolean } } })?.data ?? res) as {
        counts?: { TASK?: number };
        armed?: { TASK?: boolean };
        harsh?: { TASK?: boolean };
      };
    },
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: enabled ? 1000 * 60 : false,
    refetchOnWindowFocus: true,
  });

  if (!enabled) return { count: 0, armed: false, harsh: false };
  return { count: data?.counts?.TASK ?? 0, armed: !!data?.armed?.TASK, harsh: !!data?.harsh?.TASK };
}

/**
 * Attention engine → nav indicator. Lights the Agenda + Cronograma nav trail whenever a
 * TASK matches an attention rule for the current user (loaded rows via the local engine +
 * the server summary for the global/dashboard case). It BLINKS when anything is armed
 * (actively blinking on a row) and shows a STATIC border when everything is resting
 * (viewed / in cooldown) — so the nav mirrors the row exactly. Color = highest severity.
 */
function useAttentionNavActivity(): NavActivityHint[] {
  useAttentionVersion(); // re-render whenever local attention state flips
  const localCount = getAttentionCountsByType().get("TASK") ?? 0;
  const localArmed = getAttentionArmedByType().get("TASK") === true;
  const localHarsh = getAttentionSeverityByType().get("TASK") === "harsh";
  const { count: serverCount, armed: serverArmed, harsh: serverHarsh } = useAttentionSummary();
  const taskCount = Math.max(localCount, serverCount);
  if (taskCount <= 0) return [];
  const tone: "harsh" | "soft" = localHarsh || serverHarsh ? "harsh" : "soft";
  const armed = localArmed || serverArmed;
  // Tasks live on both Agenda (preparation) and Cronograma (schedule).
  return [
    { path: routes.production.preparation.root, count: taskCount, tone, armed }, // /producao/agenda
    { path: routes.production.schedule.root, count: taskCount, tone, armed }, // /producao/cronograma
  ];
}

/**
 * Registry of activity sources. Add a new blinking indicator by appending its hook
 * here — nothing else in the sidebar needs to change. Order is fixed (hook rules).
 */
const NAV_ACTIVITY_SOURCES: NavActivitySource[] = [useWarehousePendingCutsActivity, useAttentionNavActivity];

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
