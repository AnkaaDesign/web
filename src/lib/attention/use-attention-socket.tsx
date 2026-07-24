// =====================================================
// Attention system — socket listener (binds gateway events → engine + cache)
// =====================================================
//
// Mounted once by the AttentionProvider. Connects the dedicated `attention`
// socket and wires its events:
//   • attention:push / attention:dismiss → manual/pushed warnings into the engine
//   • presence:update                    → the presence store ("is-editing")
//   • entity:changed                     → invalidate the matching query cache so
//                                          every client reloads + re-evaluates
// No polling anywhere — everything is reactive to these pushes.

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/auth-context";
import { getLocalStorage } from "@/lib/storage";

import { connectAttentionSocket, disconnectAttentionSocket } from "./attention-socket";
import { addPushedAttention, dismissPushedAttention, type PushedAttention } from "./engine";
import { applyPresenceUpdate, clearPresence, type PresenceEditor } from "./presence";

/** entityType → the react-query root key to invalidate on change. */
const INVALIDATION_KEYS: Record<string, string> = {
  TASK: "tasks",
  CUT: "cuts",
};

export function useAttentionSocket(): void {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getLocalStorage("token");
    if (!token) return;

    const socket = connectAttentionSocket(token);

    const onPush = (payload: PushedAttention) => {
      if (payload?.id && payload?.entityType && payload?.entityId) addPushedAttention(payload);
    };
    const onDismiss = (data: { id: string }) => {
      if (data?.id) dismissPushedAttention(data.id);
    };
    const onPresence = (data: { entityType: string; entityId: string; editors: PresenceEditor[] }) => {
      if (data?.entityType && data?.entityId) applyPresenceUpdate(data.entityType, data.entityId, data.editors ?? []);
    };
    const onEntityChanged = (data: { entityType: string; entityId: string }) => {
      const rootKey = INVALIDATION_KEYS[data?.entityType];
      if (rootKey) queryClient.invalidateQueries({ queryKey: [rootKey] });
    };

    socket.on("attention:push", onPush);
    socket.on("attention:dismiss", onDismiss);
    socket.on("presence:update", onPresence);
    socket.on("entity:changed", onEntityChanged);

    return () => {
      socket.off("attention:push", onPush);
      socket.off("attention:dismiss", onDismiss);
      socket.off("presence:update", onPresence);
      socket.off("entity:changed", onEntityChanged);
      disconnectAttentionSocket();
      clearPresence();
    };
  }, [isAuthenticated, user?.id, queryClient]);
}
