/**
 * Tests for Socket.io hooks
 * Note: These are basic tests. For full integration testing, use Playwright.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { socketService } from '@/lib/socket';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: false,
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
    const token = 'test-token-123';
    const socket1 = socketService.connect(token);
    const socket2 = socketService.connect(token);

    expect(socket1).toBe(socket2);
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
