import api from './api';

export async function joinQueue(eventId, userId) {
  const response = await api.post('/queue/join', { eventId, userId });
  return response.data?.data || response.data;
}

export async function getQueueStatus(eventId, userId) {
  const response = await api.get(`/queue/status?eventId=${eventId}&userId=${userId}`);
  return response.data?.data || response.data;
}
