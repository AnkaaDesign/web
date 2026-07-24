// =====================================================
// Attention system — dedicated socket client (namespace: `attention`)
// =====================================================
//
// A small singleton connection, separate from the notifications socket, matching
// the isolated API `attention` gateway. Reuses the same base URL + token so it
// authenticates identically. Kept intentionally minimal — reconnection is handled
// by socket.io itself; the listener hook binds the app-level events.

import { io, Socket } from "socket.io-client";

import { getApiBaseUrl } from "@/config/api";

/**
 * Stable per-tab client id, generated ONCE at module load. Unlike `socket.id` (which
 * is undefined until connect and changes on every reconnect), this is constant for the
 * life of the tab — so self-exclusion of presence ("don't warn me about my own edit")
 * is reliable. Sent with every presence:enter and echoed back by the server.
 */
export const ATTENTION_CLIENT_ID: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `c${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

let socket: Socket | null = null;
let currentToken: string | null = null;
/** entityKeys this tab is currently announcing as "editing" — replayed on reconnect. */
const announced = new Set<string>();

export function connectAttentionSocket(token: string): Socket {
  if (socket?.connected && currentToken === token) return socket;
  if (socket) socket.disconnect();
  currentToken = token;
  socket = io(`${getApiBaseUrl()}/attention`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 20000,
    autoConnect: true,
  });
  // On (re)connect, replay every entity this tab is still announcing so presence
  // survives a dropped/re-established socket (the server's in-memory registry is
  // keyed by socket.id, which changes on reconnect).
  socket.on("connect", () => {
    for (const key of announced) {
      const idx = key.indexOf(":");
      socket?.emit("presence:enter", { entityType: key.slice(0, idx), entityId: key.slice(idx + 1), clientId: ATTENTION_CLIENT_ID });
    }
  });
  return socket;
}

export function getAttentionSocket(): Socket | null {
  return socket;
}

export function disconnectAttentionSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
  announced.clear();
}

// -------------------------------------------------------------------------
// Emit helpers (no-op if not yet connected — safe to call optimistically).
// -------------------------------------------------------------------------

export function emitPresenceEnter(entityType: string, entityId: string): void {
  announced.add(`${entityType}:${entityId}`);
  socket?.emit("presence:enter", { entityType, entityId, clientId: ATTENTION_CLIENT_ID });
}

export function emitPresenceLeave(entityType: string, entityId: string): void {
  announced.delete(`${entityType}:${entityId}`);
  socket?.emit("presence:leave", { entityType, entityId, clientId: ATTENTION_CLIENT_ID });
}

/** Announce a local mutation so other clients invalidate + re-evaluate. */
export function emitEntityChanged(entityType: string, entityId: string, changedFields?: string[]): void {
  socket?.emit("entity:changed", { entityType, entityId, changedFields });
}
