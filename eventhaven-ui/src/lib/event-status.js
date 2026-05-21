export function getEventEndDate(event) {
  const rawValue = event?.endTime || event?.startTime;
  if (!rawValue) return null;

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

export function isEventPast(event, now = new Date()) {
  const normalizedStatus = normalizeStatus(event?.status);
  if (['PAST', 'ENDED', 'COMPLETED'].includes(normalizedStatus)) return true;
  if (['LIVE', 'PENDING', 'DRAFT'].includes(normalizedStatus)) return false;

  const referenceDate = now instanceof Date ? now : new Date();
  const endDate = getEventEndDate(event);
  return endDate ? endDate.getTime() < referenceDate.getTime() : false;
}

export function getAdminEventStatus(event, now = new Date()) {
  const normalizedStatus = normalizeStatus(event?.status);
  if (normalizedStatus === 'LIVE') return 'Live';
  if (normalizedStatus === 'PENDING') return 'Pending';
  if (normalizedStatus === 'DRAFT') return 'Draft';
  if (['PAST', 'ENDED', 'COMPLETED'].includes(normalizedStatus)) return 'Past';

  if (isEventPast(event, now)) return 'Past';

  if (!event?.startTime) return 'Draft';

  const startDate = new Date(event.startTime);
  if (Number.isNaN(startDate.getTime())) return 'Draft';

  return startDate.getTime() > now.getTime() ? 'Pending' : 'Live';
}

export function isEventBookable(event, now = new Date()) {
  return getAdminEventStatus(event, now) === 'Live';
}

export function isCustomerVisibleEvent(event, now = new Date()) {
  return getAdminEventStatus(event, now) !== 'Draft';
}

export function isEventPending(event, now = new Date()) {
  return getAdminEventStatus(event, now) === 'Pending';
}

export function getApiEventStatus(event, now = new Date()) {
  const status = getAdminEventStatus(event, now);
  if (status === 'Past') return 'PAST';
  return status.toUpperCase();
}
