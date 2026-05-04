import api from './api';

export async function getEventById(id) {
  const response = await api.get(`/events/${id}`);
  return response.data?.data || response.data;
}

export async function getSeatMap(id) {
  const response = await api.get(`/events/${id}/seat-map`);
  return response.data?.data || response.data;
}

export async function getSeatLayout(id) {
  const response = await api.get(`/events/${id}/seat-layout`);
  return response.data?.data || response.data;
}

export async function lockSeat(eventId, seatId, holderId, holdMinutes = 10) {
  const response = await api.post(`/events/${eventId}/seats/${seatId}/lock`, {
    holderId,
    holdMinutes,
  });
  return response.data?.data || response.data;
}

export async function releaseSeat(eventId, seatId, holderId) {
  const response = await api.post(`/events/${eventId}/seats/${seatId}/release`, {
    holderId,
  });
  return response.data?.data || response.data;
}
