import api from './api';

export async function getEventById(id, { includeDraft = false } = {}) {
  const response = await api.get(`/events/${id}${includeDraft ? '?includeDraft=true' : ''}`);
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

export async function searchEvents({ q, category, from, to, sort, includeDraft = false } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category && category !== 'all') params.set('category', category);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (sort) params.set('sort', sort);
  if (includeDraft) params.set('includeDraft', 'true');

  const response = await api.get(`/events/search?${params.toString()}`);
  return response.data?.data || response.data || [];
}

export async function getEventReviews(eventId) {
  const response = await api.get(`/events/${eventId}/reviews`);
  return response.data?.data || response.data || [];
}

export async function getEventReviewSummary(eventId) {
  const response = await api.get(`/events/${eventId}/reviews/summary`);
  return response.data?.data || response.data;
}

export async function submitEventReview(eventId, payload) {
  const response = await api.post(`/events/${eventId}/reviews`, payload);
  return response.data?.data || response.data;
}
