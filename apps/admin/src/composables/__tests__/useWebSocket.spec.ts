import { describe, it, expect, vi } from 'vitest';
import { useWebSocket } from '../useWebSocket';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockSocket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      (listeners[event] ??= []).push(handler);
      // Auto-trigger 'connect' to simulate successful connection
      if (event === 'connect') {
        handler();
      }
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };
  return {
    io: vi.fn(() => mockSocket),
    default: { io: vi.fn(() => mockSocket) },
  };
});

describe('useWebSocket', () => {
  it('connects and returns socket ref', () => {
    const { connected } = useWebSocket('/dashboard');
    expect(connected.value).toBe(true);
  });

  it('disconnects on cleanup when called', () => {
    const { disconnect } = useWebSocket('/dashboard');
    disconnect();
    // should not throw
  });
});
