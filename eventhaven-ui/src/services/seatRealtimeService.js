import { getApiOrigin } from './api';
import { getAuthToken } from '../lib/auth';

export function getSeatMapWebSocketUrl(eventId) {
  const apiOrigin = getApiOrigin();
  const wsOrigin = apiOrigin.replace(/^http/i, apiOrigin.startsWith('https') ? 'wss' : 'ws');
  const baseUrl = `${wsOrigin}/ws/events/${encodeURIComponent(eventId)}/seats`;
  const token = getAuthToken();
  return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;
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
