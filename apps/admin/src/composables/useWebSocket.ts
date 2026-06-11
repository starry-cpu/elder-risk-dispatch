import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';

export function useWebSocket(namespace: string) {
  const connected = ref(false);
  let socket: Socket | null = null;

  function connect() {
    const token = localStorage.getItem('token');
    socket = io(namespace, {
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
