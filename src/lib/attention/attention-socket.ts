// =====================================================
// Attention system — dedicated socket client (namespace: `attention`)
// =====================================================
//
// A small singleton connection, separate from the notifications socket, matching
// the isolated API `attention` gateway. Reuses the same base URL + token so it
// authenticates identically.
//
// Owns three things beyond plain event plumbing, all of them load-bearing for the
// override guard:
//   1. REFCOUNTED announces — one tab can hold the same entity from several places
//      (detail page + an inline field). Emitting a raw `leave` for the first one to
//      close would release the whole tab's lock while the other is still editing.
//   2. HEARTBEAT — tells the server this tab is still alive. A frozen or backgrounded
//      tab keeps its socket nominally connected far longer than the user is actually
//      present; the server evicts anyone who stops heartbeating.
//   3. SNAPSHOT on (re)connect — presence is otherwise push-on-change, so a client
//      joining after an edit began would see nobody holding the record.

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

/** Must stay well under the gateway's PRESENCE_TTL_MS (45s) so a couple of dropped
 * beats don't cost this tab its lock. */
const HEARTBEAT_MS = 20_000;

let socket: Socket | null = null;
let currentToken: string | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/** entityKey → how many announcers in this tab currently hold it. Replayed on reconnect. */
const announced = new Map<string, number>();

/** Ask for a full registry snapshot. The server answers with a `presence:snapshot`
 * event (see use-attention-socket.tsx) — it also pushes one unprompted on connect,
 * so this is belt-and-braces after a reconnect. */
function requestSnapshot(): void {
  socket?.emit("presence:sync", {});
}

function startHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    // Only meaningful while this tab actually holds something.
    if (announced.size > 0) socket?.emit("presence:heartbeat", {});
  }, HEARTBEAT_MS);
}

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

  // On (re)connect: replay every entity this tab still holds (the server's registry is
  // keyed by socket.id, which changes on reconnect), then pull a full snapshot so we
  // also learn about edits that started while we were away.
  socket.on("connect", () => {
    for (const [key, refs] of announced) {
      const idx = key.indexOf(":");
      const entityType = key.slice(0, idx);
      const entityId = key.slice(idx + 1);
      // Re-announce once per held ref so the server's refcount matches ours.
      for (let i = 0; i < refs; i++) {
        socket?.emit("presence:enter", { entityType, entityId, clientId: ATTENTION_CLIENT_ID });
      }
    }
    requestSnapshot();
  });

  startHeartbeat();
  return socket;
}

/**
 * Swap in a rotated access token WITHOUT losing presence.
 *
 * Access tokens are short-lived; the socket captured its token at connect time and
 * socket.io replays that same value on every reconnect. After a refresh, the next
 * reconnect would hand the gateway an expired token, get disconnected, and retry
 * forever — presence and pushed warnings silently dead until a full page reload.
 */
export function updateAttentionSocketToken(token: string): void {
  if (!socket || currentToken === token) return;
  currentToken = token;
  (socket.auth as { token?: string }) = { token };
  // Force a reconnect so the handshake uses the new token. `announced` survives, and
  // the `connect` handler above replays it.
  socket.disconnect().connect();
}

export function getAttentionSocket(): Socket | null {
  return socket;
}

export function disconnectAttentionSocket(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
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
  const key = `${entityType}:${entityId}`;
  announced.set(key, (announced.get(key) ?? 0) + 1);
  socket?.emit("presence:enter", { entityType, entityId, clientId: ATTENTION_CLIENT_ID });
}

export function emitPresenceLeave(entityType: string, entityId: string): void {
  const key = `${entityType}:${entityId}`;
  const refs = (announced.get(key) ?? 1) - 1;
  if (refs <= 0) announced.delete(key);
  else announced.set(key, refs);
  socket?.emit("presence:leave", { entityType, entityId, clientId: ATTENTION_CLIENT_ID });
}

/** Announce a local mutation so other clients invalidate + re-evaluate. */
export function emitEntityChanged(entityType: string, entityId: string, changedFields?: string[]): void {
  socket?.emit("entity:changed", { entityType, entityId, changedFields });
}
