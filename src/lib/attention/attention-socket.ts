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

let socket: Socket | null = null;
let currentToken: string | null = null;

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
}

// -------------------------------------------------------------------------
// Emit helpers (no-op if not yet connected — safe to call optimistically).
// -------------------------------------------------------------------------

export function emitPresenceEnter(entityType: string, entityId: string): void {
  socket?.emit("presence:enter", { entityType, entityId });
}

export function emitPresenceLeave(entityType: string, entityId: string): void {
  socket?.emit("presence:leave", { entityType, entityId });
}

/** Announce a local mutation so other clients invalidate + re-evaluate. */
export function emitEntityChanged(entityType: string, entityId: string, changedFields?: string[]): void {
  socket?.emit("entity:changed", { entityType, entityId, changedFields });
}
