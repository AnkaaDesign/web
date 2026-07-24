// =====================================================
// Attention system — provider + entity registry
// =====================================================
//
// Mounted ONCE near the app root (inside the router + auth providers). It:
//   • feeds the current user's privilege into the engine (rule targeting),
//   • merges entities registered by many SOURCES (task tables, the task detail
//     page, cut table, …) into the engine's per-type registry,
//   • tears the engine down on unmount (logout).
//
// It renders nothing visual. Components read blink state via the hooks in
// `use-attention.ts`; they never touch the engine or this registry directly.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

import { useAuth } from "@/contexts/auth-context";

import { createServerBackedAckStore, type ServerAckStore } from "./ack-store-server";
import { configureAckStore, refreshAttention, resetEngine, setEntities, setUserPrivilege } from "./engine";
import { SendWarningProvider } from "./send-warning";
import { useAttentionSocket } from "./use-attention-socket";
import type { AttentionEntityType } from "./types";

type EntityLike = { id: string };

interface AttentionRegistry {
  /** Register/replace one source's entities of a type. Returns an unregister fn. */
  register: (sourceId: string, type: AttentionEntityType, list: ReadonlyArray<EntityLike>) => void;
  unregister: (sourceId: string, type: AttentionEntityType) => void;
}

const AttentionContext = createContext<AttentionRegistry | null>(null);

export function AttentionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const privilege = user?.sector?.privileges as string | undefined;

  // Connect the real-time channel (presence + pushed warnings + change invalidation).
  useAttentionSocket();

  // Server-backed ack store (cross-device cooldown/snooze), with localStorage as the
  // offline cache. Configure once; hydrate the current user's acks on login.
  const ackStoreRef = useRef<ServerAckStore | null>(null);
  if (!ackStoreRef.current) {
    ackStoreRef.current = createServerBackedAckStore();
    configureAckStore(ackStoreRef.current);
  }
  useEffect(() => {
    if (!privilege) return;
    void ackStoreRef.current?.hydrate().then(() => refreshAttention());
  }, [privilege, user?.id]);

  // type → sourceId → entities. Merged (later source wins on id collision) and
  // pushed to the engine whenever any source changes.
  const registryRef = useRef<Map<AttentionEntityType, Map<string, ReadonlyArray<EntityLike>>>>(new Map());

  const flush = useCallback((type: AttentionEntityType) => {
    const bySource = registryRef.current.get(type);
    const merged = new Map<string, EntityLike>();
    if (bySource) {
      for (const list of bySource.values()) {
        for (const e of list) if (e && e.id != null) merged.set(String(e.id), e);
      }
    }
    setEntities(type, [...merged.values()]);
  }, []);

  const register = useCallback(
    (sourceId: string, type: AttentionEntityType, list: ReadonlyArray<EntityLike>) => {
      let bySource = registryRef.current.get(type);
      if (!bySource) {
        bySource = new Map();
        registryRef.current.set(type, bySource);
      }
      bySource.set(sourceId, list);
      flush(type);
    },
    [flush],
  );

  const unregister = useCallback(
    (sourceId: string, type: AttentionEntityType) => {
      const bySource = registryRef.current.get(type);
      if (!bySource) return;
      bySource.delete(sourceId);
      flush(type);
    },
    [flush],
  );

  useEffect(() => {
    setUserPrivilege(privilege);
  }, [privilege]);

  // Only true unmount (logout / app teardown) resets the engine.
  useEffect(() => () => resetEngine(), []);

  const value = useMemo<AttentionRegistry>(() => ({ register, unregister }), [register, unregister]);

  return (
    <AttentionContext.Provider value={value}>
      <SendWarningProvider>{children}</SendWarningProvider>
    </AttentionContext.Provider>
  );
}

/** Internal — used by the registration hook. Returns null-object when no provider. */
export function useAttentionRegistry(): AttentionRegistry {
  return (
    useContext(AttentionContext) ?? {
      register: () => {},
      unregister: () => {},
    }
  );
}
