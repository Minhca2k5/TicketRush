import api from './api';

export async function lockSeat(eventId, seatId, holderId, holdMinutes = 10) {
  const response = await api.post('/booking/lock', {
    eventId,
    seatIds: [seatId],
    holderId,
    holdMinutes,
  });
  return response.data?.data || response.data;
}

export async function releaseSeat(eventId, seatId, holderId) {
  const response = await api.post('/booking/release', {
    eventId,
    seatIds: [seatId],
    holderId,
  });
  return response.data?.data || response.data;
}

export async function checkout(eventId, seatIds, holderId) {
  const response = await api.post('/booking/checkout', {
    eventId,
    seatIds,
    holderId,
  });
  return response.data?.data || response.data;
}
