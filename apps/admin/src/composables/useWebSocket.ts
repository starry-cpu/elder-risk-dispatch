import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';

// API base URL for WebSocket — in dev the admin runs on :5173 while the
// Socket.IO gateway is on the API server (:3000). Configure this via
// VITE_WS_URL or default to the Vite proxy target.
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export function useWebSocket(namespace: string) {
  const connected = ref(false);
  let socket: Socket | null = null;

  function connect() {
    const token = localStorage.getItem('token');
    socket = io(`${WS_BASE_URL}${namespace}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      connected.value = true;
    });

    socket.on('disconnect', () => {
      connected.value = false;
    });
  }

  function on(event: string, handler: (...args: unknown[]) => void) {
    socket?.on(event, handler);
  }

  function off(event: string, handler?: (...args: unknown[]) => void) {
    socket?.off(event, handler);
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    connected.value = false;
  }

  connect();

  onUnmounted(() => {
    disconnect();
  });

  return { connected, on, off, disconnect };
}
