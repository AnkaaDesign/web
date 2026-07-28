// =====================================================
// Attention system — the server's half of the match set
// =====================================================
//
// Polls `GET /attention/summary` and feeds the result into the engine as remote matches.
//
// WHY this exists at all: the engine can only evaluate records a mounted page registered, and
// a blink/bip cycle only exists for a match. So on every page that loads neither tasks nor
// cuts — Observações, a dashboard, anything under /pessoal — there was no cycle, and therefore
// no bip. Not a misconfiguration: there was nothing in existence to make the sound. Meanwhile
// the nav ring DID light from this endpoint, because it consumed plain counts. The result was
// that the signal was audible only where the rows were already visible, and silent everywhere
// it was the only channel available.
//
// The endpoint now returns match REFS (`ruleId` + `entityId`), so those records get real
// cycles and the sound follows the user. Rule metadata never travels — the client resolves
// `ruleId` against its own registry, which is what keeps remote and local matches identical in
// kind and leaves ONE authority (the engine + its ack store) on armed vs resting.
//
// Mounted once, by `AttentionProvider`.

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/api-client/axiosClient";
import { SECTOR_PRIVILEGES } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { canAccessAnyPrivilege } from "@/utils/privilege";

import { ATTENTION_ACTIVE_TYPES, attentionAudience } from "./entities";
import { setRemoteMatches, type RemoteMatchRef } from "./engine";

/** The react-query key. Invalidated on ack writes and on `entity:changed` (socket). */
export const ATTENTION_SUMMARY_KEY = ["attention-summary"] as const;

interface AttentionMatchesResponse {
  matches: RemoteMatchRef[];
  /** Rules the server actually ran — how far an ABSENCE from `matches` can be trusted. */
  evaluatedRuleIds: string[];
  /** Types whose list the server capped — absence from `matches` is not resolution. */
  truncatedTypes: string[];
}

/** Backstop poll. The socket's `entity:changed` is what normally keeps this fresh. */
const POLL_MS = 60 * 1000;

export function useAttentionSummary(): void {
  const { user } = useAuth();
  const userPrivilege = user?.sector?.privileges as SECTOR_PRIVILEGES | undefined;

  // A user who can see no rule at all never issues the request.
  const enabled = useMemo(() => {
    if (!userPrivilege) return false;
    return ATTENTION_ACTIVE_TYPES.some((type) => {
      const audience = attentionAudience(type);
      return audience === null || canAccessAnyPrivilege(userPrivilege, audience as never);
    });
  }, [userPrivilege]);

  const { data } = useQuery({
    queryKey: ATTENTION_SUMMARY_KEY,
    queryFn: async () => {
      const res = await apiClient.get("/attention/summary");
      const body = ((res as { data?: AttentionMatchesResponse })?.data ?? res) as AttentionMatchesResponse;
      return {
        matches: body?.matches ?? [],
        evaluatedRuleIds: body?.evaluatedRuleIds ?? [],
        truncatedTypes: body?.truncatedTypes ?? [],
      };
    },
    enabled,
    staleTime: POLL_MS / 2,
    refetchInterval: enabled ? POLL_MS : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // No data yet, or the user sees no rules → an EMPTY remote set, not a stale one. Handing
    // the engine nothing is correct here; handing it the previous poll's matches would keep
    // beeping about records the user can no longer see.
    if (!enabled || !data) {
      setRemoteMatches([], {});
      return;
    }
    setRemoteMatches(data.matches, { evaluatedRuleIds: data.evaluatedRuleIds, truncatedTypes: data.truncatedTypes });
  }, [enabled, data]);
}
