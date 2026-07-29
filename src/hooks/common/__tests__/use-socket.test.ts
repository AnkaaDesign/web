/**
 * Tests for Socket.io hooks
 * Note: These are basic tests. For full integration testing, use Playwright.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { socketService } from '@/lib/socket';

// Mock socket.io-client.
//
// `connected` is READ THROUGH a mutable flag rather than fixed, because the suite needs it both
// ways and `socketService` branches on it: `connect()` hands back the existing socket only when
// that socket is ACTUALLY connected and the token matches — a dead one is deliberately replaced.
// So the reuse case has to say the socket is up, while `isConnected()` starts from a socket that
// is not. A single hard-coded value can only ever satisfy one of them.
const socketState = vi.hoisted(() => ({ connected: false }));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    get connected() {
      return socketState.connected;
    },
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

describe('SocketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketState.connected = false;
  });

  afterEach(() => {
    socketService.disconnect();
  });

  it('should create a singleton instance', () => {
    expect(socketService).toBeDefined();
    expect(socketService.connect).toBeDefined();
    expect(socketService.disconnect).toBeDefined();
    expect(socketService.getSocket).toBeDefined();
  });

  it('should connect with token', () => {
    const token = 'test-token-123';
    const socket = socketService.connect(token);

    expect(socket).toBeDefined();
  });

  it('should return same socket for same token', () => {
    // Reuse is conditional on the socket being live — see the mock note above.
    socketState.connected = true;
    const token = 'test-token-123';
    const socket1 = socketService.connect(token);
    const socket2 = socketService.connect(token);

    expect(socket1).toBe(socket2);
  });

  it('replaces a socket that is no longer connected, even for the same token', () => {
    const token = 'test-token-123';
    const dead = socketService.connect(token); // socketState.connected === false
    const fresh = socketService.connect(token);

    expect(fresh).not.toBe(dead);
  });

  it('should disconnect and clean up', () => {
    const token = 'test-token-123';
    socketService.connect(token);
    socketService.disconnect();

    expect(socketService.getSocket()).toBeNull();
  });

  it('should emit events when connected', () => {
    const token = 'test-token-123';
    const socket = socketService.connect(token);

    // Mock connected state
    Object.defineProperty(socket, 'connected', { value: true, writable: true });

    socketService.emit('test:event', { data: 'test' });

    expect(socket.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
  });

  it('should check connection status', () => {
    const token = 'test-token-123';
    socketService.connect(token);

    // Initially not connected (mocked)
    expect(socketService.isConnected()).toBe(false);
  });
});
