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

export async function checkout(eventId, seatIds, holderId, customer = {}, couponCode = '') {
  const response = await api.post('/booking/checkout', {
    eventId,
    seatIds,
    holderId,
    customerEmail: customer.email,
    customerName: customer.name,
    couponCode,
  });
  return response.data?.data || response.data;
}

export async function getUserOrders(userId) {
  const response = await api.get(`/booking/orders/${userId}`);
  return response.data?.data || response.data;
}

export async function validateCoupon(code, totalPrice) {
  const response = await api.get(`/booking/coupons/validate`, {
    params: { code, totalPrice }
  });
  return response.data;
}

export async function getAllCoupons() {
  const response = await api.get('/booking/admin/coupons');
  return response.data?.data || response.data;
}

export async function createCoupon(couponData) {
  const response = await api.post('/booking/admin/coupons', couponData);
  return response.data?.data || response.data;
}

export async function deleteCoupon(id) {
  const response = await api.delete(`/booking/admin/coupons/${id}`);
  return response.data?.data || response.data;
}
