import api from './api';

export async function getNotifications(userId) {
  const response = await api.get(`/booking/notifications/${encodeURIComponent(userId)}`);
  return response.data?.data || response.data || [];
}

export async function getUnreadNotificationCount(userId) {
  const response = await api.get(`/booking/notifications/${encodeURIComponent(userId)}/unread-count`);
  const payload = response.data?.data || response.data || {};
  return Number(payload.count || 0);
}

export async function markNotificationRead(userId, notificationId) {
  const response = await api.patch(`/booking/notifications/${encodeURIComponent(userId)}/${notificationId}/read`);
  return response.data?.data || response.data;
}

export async function markAllNotificationsRead(userId) {
  const response = await api.patch(`/booking/notifications/${encodeURIComponent(userId)}/read-all`);
  return response.data?.data || response.data || [];
}

export async function deleteNotification(userId, notificationId) {
  await api.delete(`/booking/notifications/${encodeURIComponent(userId)}/${notificationId}`);
}

export async function clearNotifications(userId) {
  await api.delete(`/booking/notifications/${encodeURIComponent(userId)}`);
}
