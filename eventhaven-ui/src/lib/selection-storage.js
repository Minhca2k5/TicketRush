const SELECTION_STORAGE_PREFIX = "ticketrush-seat-selection";

export function getSelectionStorageKey(eventId, holderId) {
  return `${SELECTION_STORAGE_PREFIX}:${eventId}:${holderId}`;
}

export function readStoredSelection(eventId, holderId) {
  if (!eventId || !holderId) return null;

  try {
    const stored = window.localStorage.getItem(getSelectionStorageKey(eventId, holderId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function writeStoredSelection(eventId, holderId, payload) {
  if (!eventId || !holderId) return;

  const key = getSelectionStorageKey(eventId, holderId);
  if (!payload?.selectedSeatIds?.length) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(payload));
}
