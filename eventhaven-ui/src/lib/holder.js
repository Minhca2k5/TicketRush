const HOLDER_STORAGE_KEY = "ticketrush-seat-holder";

export function getAccountHolderId(profile) {
  if (profile?.id) return `user-${profile.id}`;
  if (profile?.username) return `user-${profile.username}`;
  return null;
}

export function getOrCreateHolderId() {
  const existing = window.localStorage.getItem(HOLDER_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = `holder-${crypto.randomUUID()}`;
  window.localStorage.setItem(HOLDER_STORAGE_KEY, generated);
  return generated;
}

export function getStoredHolderId() {
  return window.localStorage.getItem(HOLDER_STORAGE_KEY);
}

export function setStoredHolderId(holderId) {
  window.localStorage.setItem(HOLDER_STORAGE_KEY, holderId);
}

export { HOLDER_STORAGE_KEY };
