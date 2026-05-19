import { getApiOrigin } from './api';

export function getSeatMapWebSocketUrl(eventId) {
  const apiOrigin = getApiOrigin();
  const wsOrigin = apiOrigin.replace(/^http/i, apiOrigin.startsWith('https') ? 'wss' : 'ws');
  return `${wsOrigin}/ws/events/${encodeURIComponent(eventId)}/seats`;
}

export function openSeatMapSocket(eventId, handlers = {}) {
  const socket = new WebSocket(getSeatMapWebSocketUrl(eventId));

  socket.onopen = (event) => {
    handlers.onOpen?.(event);
  };

  socket.onmessage = (event) => {
    try {
      handlers.onMessage?.(JSON.parse(event.data), event);
    } catch {
      handlers.onMessage?.(null, event);
    }
  };

  socket.onerror = (event) => {
    handlers.onError?.(event);
  };

  socket.onclose = (event) => {
    handlers.onClose?.(event);
  };

  return socket;
}
