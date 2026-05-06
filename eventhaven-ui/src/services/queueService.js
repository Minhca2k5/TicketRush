import api from './api';

export async function joinQueue(eventId) {
  const response = await api.post('/queue/join', { eventId });
  return response.data?.data || response.data;
}

export async function getQueueStatus(eventId) {
  const response = await api.get(`/queue/status?eventId=${eventId}`);
  return response.data?.data || response.data;
}
