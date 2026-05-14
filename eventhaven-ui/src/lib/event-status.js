export function getEventEndDate(event) {
  const rawValue = event?.endTime || event?.startTime;
  if (!rawValue) return null;

  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isEventPast(event, now = new Date()) {
  const referenceDate = now instanceof Date ? now : new Date();
  const endDate = getEventEndDate(event);
  return endDate ? endDate.getTime() < referenceDate.getTime() : false;
}

export function isEventBookable(event, now = new Date()) {
  return !isEventPast(event, now);
}

export function getAdminEventStatus(event, now = new Date()) {
  if (isEventPast(event, now)) return 'Past';

  const normalizedStatus = String(event?.status || '').trim().toUpperCase();
  if (normalizedStatus === 'LIVE') return 'Live';
  if (normalizedStatus === 'PENDING') return 'Pending';
  if (normalizedStatus === 'DRAFT') return 'Draft';

  if (!event?.startTime) return 'Draft';

  const startDate = new Date(event.startTime);
  if (Number.isNaN(startDate.getTime())) return 'Draft';

  const diff = startDate.getTime() - now.getTime();
  if (diff <= 0) return 'Live';
  if (diff < 1000 * 60 * 60 * 24 * 14) return 'Pending';
  return 'Draft';
}

export function getApiEventStatus(event, now = new Date()) {
  const status = getAdminEventStatus(event, now);
  if (status === 'Past') return 'PAST';
  return status.toUpperCase();
}
