export const defaultUserSettings = {
  emailNotifications: true,
  bookingReminders: true,
  ticketUpdates: true,
  compactTickets: false,
  defaultView: 'events',
  holdReminderMinutes: 2,
};

export function getUserSettingsStorageKey(profile) {
  if (profile?.id) return `ticketrush-user-settings:user-${profile.id}`;
  return 'ticketrush-user-settings:guest';
}

export function readUserSettings(profile) {
  const storageKey = getUserSettingsStorageKey(profile);

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return { ...defaultUserSettings, ...(saved || {}) };
  } catch {
    return defaultUserSettings;
  }
}

export function getDefaultRoute(defaultView) {
  if (defaultView === 'tickets') return '/orders';
  if (defaultView === 'profile') return '/profile';
  return '/';
}
