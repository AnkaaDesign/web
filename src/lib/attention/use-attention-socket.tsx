// =====================================================
// Attention system — socket listener (binds gateway events → engine + cache)
// =====================================================
//
// Mounted once by the AttentionProvider. Connects the dedicated `attention`
// socket and wires its events:
//   • attention:push / attention:dismiss → manual/pushed warnings into the engine
//   • presence:update / presence:sync    → the presence store ("is-editing")
//   • entity:changed                     → invalidate the matching query cache so
//                                          every client reloads + re-evaluates

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { getLocalStorage } from "@/lib/storage";

import { connectAttentionSocket, disconnectAttentionSocket, updateAttentionSocketToken } from "./attention-socket";
import { ATTENTION_ACTIVE_TYPES } from "./entities";
import { addPushedAttention, dismissPushedAttention, type PushedAttention } from "./engine";
import { applyPresenceSnapshot, applyPresenceUpdate, clearPresence, type PresenceEditor } from "./presence";
import { ATTENTION_SUMMARY_KEY } from "./use-attention-summary";

/**
 * entityType → the react-query root key to invalidate on change.
 *
 * Keep in step with `ATTENTION_ENTITY_TYPES` (types.ts). An entity absent here still
 * gets full presence support — it just won't trigger a cache invalidation, which is
 * the correct default until someone declares where its data lives.
 */
const INVALIDATION_KEYS: Partial<Record<string, string>> = {
  TASK: "tasks",
  CUT: "cuts",
  ORDER: "orders",
  ITEM: "items",
  AIRBRUSHING: "airbrushings",
  OBSERVATION: "observations",
  SERVICE_ORDER: "serviceOrders",
  TASK_QUOTE: "taskQuotes",
  TRUCK: "trucks",
  CUSTOMER: "customers",
  SUPPLIER: "suppliers",
  PAINT: "paints",
  USER: "users",
  BORROW: "borrows",
  EXTERNAL_WITHDRAWAL: "externalWithdrawals",
  PPE_DELIVERY: "ppeDeliveries",
};

/** Coalesce `entity:changed` bursts before touching react-query. A bulk action emits
 * one event per row; without this, 40 rows = 40 full list refetches on every connected
 * client. One trailing flush per window collapses that to one refetch per entity type. */
const INVALIDATE_DEBOUNCE_MS = 300;

/** How often to notice that the access token rotated. Cheap (a localStorage read). */
const TOKEN_WATCH_MS = 30_000;

export function useAttentionSocket(): void {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getLocalStorage("token");
    if (!token) return;

    const socket = connectAttentionSocket(token);

    // --- debounced invalidation -------------------------------------------------
    const pendingRoots = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      const roots = [...pendingRoots];
      pendingRoots.clear();
      for (const root of roots) queryClient.invalidateQueries({ queryKey: [root] });
    };

    const onPush = (payload: PushedAttention) => {
      if (payload?.id && payload?.entityType && payload?.entityId) addPushedAttention(payload);
    };
    const onDismiss = (data: { id: string }) => {
      if (data?.id) dismissPushedAttention(data.id);
    };
    const onPresence = (data: { entityType: string; entityId: string; editors: PresenceEditor[] }) => {
      if (data?.entityType && data?.entityId) applyPresenceUpdate(data.entityType, data.entityId, data.editors ?? []);
    };
    // Pushed by the server on connect, and again whenever we ask via `presence:sync`.
    const onSnapshot = (data: { entities?: Array<{ entityType: string; entityId: string; editors: PresenceEditor[] }> }) => {
      if (Array.isArray(data?.entities)) applyPresenceSnapshot(data.entities);
    };
    const onEntityChanged = (data: { entityType: string; entityId: string }) => {
      // A change to an entity that carries RULES also changes the server's match set, and that
      // set is what the engine builds off-screen cycles (and therefore bips) from. Refreshing
      // it here is what keeps the sound tied to reality: on the 60s backstop poll alone, a task
      // could go overdue — or be fixed — and the bip would lag a minute behind either way.
      // The summary's key is a single segment, so it rides the same debounced flush.
      if (ATTENTION_ACTIVE_TYPES.includes(data?.entityType as never)) pendingRoots.add(ATTENTION_SUMMARY_KEY[0]);
      const rootKey = INVALIDATION_KEYS[data?.entityType];
      if (rootKey) pendingRoots.add(rootKey);
      if (pendingRoots.size && !flushTimer) flushTimer = setTimeout(flush, INVALIDATE_DEBOUNCE_MS);
    };

    socket.on("attention:push", onPush);
    socket.on("attention:dismiss", onDismiss);
    socket.on("presence:update", onPresence);
    socket.on("presence:snapshot", onSnapshot);
    socket.on("entity:changed", onEntityChanged);

    // A dropped socket misses every event in the gap. On reconnect the socket client
    // re-announces + pulls a presence snapshot; here we also refresh the data itself,
    // since the heavy pages opt out of refetchOnWindowFocus and would otherwise stay
    // stale indefinitely after a blip.
    const onReconnect = () => {
      for (const root of new Set(Object.values(INVALIDATION_KEYS))) {
        if (root) pendingRoots.add(root);
      }
      // Every `entity:changed` in the gap was missed, so the match set is of unknown age.
      pendingRoots.add(ATTENTION_SUMMARY_KEY[0]);
      if (!flushTimer) flushTimer = setTimeout(flush, INVALIDATE_DEBOUNCE_MS);
    };
    socket.io.on("reconnect", onReconnect);

    // Keep the socket's credential current — see updateAttentionSocketToken.
    const tokenWatch = setInterval(() => {
      const latest = getLocalStorage("token");
      if (latest) updateAttentionSocketToken(latest);
    }, TOKEN_WATCH_MS);

    return () => {
      socket.off("attention:push", onPush);
      socket.off("attention:dismiss", onDismiss);
      socket.off("presence:update", onPresence);
      socket.off("presence:snapshot", onSnapshot);
      socket.off("entity:changed", onEntityChanged);
      socket.io.off("reconnect", onReconnect);
      clearInterval(tokenWatch);
      if (flushTimer) clearTimeout(flushTimer);
      disconnectAttentionSocket();
      clearPresence();
    };
  }, [isAuthenticated, user?.id, queryClient]);
}
