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

import { routes, SECTOR_PRIVILEGES, CUT_STATUS } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { canAccessAnyPrivilege } from "@/utils/privilege";
import { useCuts } from "@/hooks/production/use-cut";

/** A single "this nav entry needs attention" signal. */
export interface NavActivityHint {
  /** Route path of the nav entry that has pending activity (e.g. "/producao/recorte"). */
  path: string;
  /** How many pending items (optional; reserved for future count badges). */
  count?: number;
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
  return [{ path: routes.production.cutting.root, count }];
}

/**
 * Registry of activity sources. Add a new blinking indicator by appending its hook
 * here — nothing else in the sidebar needs to change. Order is fixed (hook rules).
 */
const NAV_ACTIVITY_SOURCES: NavActivitySource[] = [useWarehousePendingCutsActivity];

export interface NavActivity {
  /** Route paths that currently have pending activity. */
  paths: Set<string>;
  /** Pending count per path (0 when a source didn't report one). */
  counts: Map<string, number>;
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
    .map((h) => `${h.path}:${h.count ?? 0}`)
    .sort()
    .join("|");

  return useMemo(() => {
    const paths = new Set<string>();
    const counts = new Map<string, number>();
    for (const hint of hints.flat()) {
      paths.add(hint.path);
      counts.set(hint.path, (counts.get(hint.path) ?? 0) + (hint.count ?? 0));
    }
    return { paths, counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
