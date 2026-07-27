// =====================================================
// Attention system — save-time override guard
// =====================================================
//
// Presence is streamed over the socket, which is enough to RENDER a badge or grey out
// an "Editar" button. It is NOT enough to gate a save: by the moment the user hits
// Salvar, this tab's socket may have dropped, missed events while backgrounded, or
// simply never learned about an editor who arrived during a reconnect gap.
//
// So the save path asks the server directly. One in-memory lookup, no DB — cheap enough
// to run on every submit, and definitive.

import { apiClient } from "@/api-client/axiosClient";

import { ATTENTION_CLIENT_ID } from "./attention-socket";
import type { PresenceEditor } from "./presence";
import type { AttentionEntityType } from "./types";

export interface PresenceGuardResult {
  /** Editors other than this tab, one entry per user, earliest first. */
  others: PresenceEditor[];
  /** False when the check could not reach the server — callers should NOT block on it
   * (failing closed would make the app unusable whenever attention is down). */
  reliable: boolean;
}

/**
 * Who else holds this entity right now, per the server.
 *
 * Fails OPEN: if the endpoint errors (attention module down, migration not applied,
 * offline) the caller gets `others: []` with `reliable: false`. Blocking saves on an
 * unreachable advisory service would be a far worse failure than the race it prevents.
 */
export async function checkOtherEditors(type: AttentionEntityType, id: string): Promise<PresenceGuardResult> {
  try {
    // No toast suppression needed: this is a GET (the interceptor only toasts writes),
    // and `/attention` is skip-listed on the error path too — a failed probe must stay
    // silent, since the guard fails open and the user never asked for this request.
    const res = await apiClient.get(`/attention/presence/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
    const payload = (res as { data?: { editors?: PresenceEditor[] } })?.data ?? (res as { editors?: PresenceEditor[] });
    const editors = payload?.editors ?? [];

    const others = editors.filter((e) => e.clientId !== ATTENTION_CLIENT_ID);
    // Collapse multiple tabs of the same user, keeping the earliest start.
    const byUser = new Map<string, PresenceEditor>();
    for (const e of others) {
      const existing = byUser.get(e.userId);
      if (!existing || e.since < existing.since) byUser.set(e.userId, e);
    }
    return { others: [...byUser.values()].sort((a, b) => a.since - b.since), reliable: true };
  } catch {
    return { others: [], reliable: false };
  }
}

/** Human sentence for a confirm dialog — "Ana está editando esta tarefa há 4 min." */
export function describeEditors(others: ReadonlyArray<PresenceEditor>, sinceLabel: (since: number) => string): string {
  if (others.length === 0) return "";
  if (others.length === 1) {
    return `${others[0].userName} está editando este registro ${sinceLabel(others[0].since)}.`;
  }
  const names = others.map((e) => e.userName).join(", ");
  return `${names} estão editando este registro agora.`;
}
