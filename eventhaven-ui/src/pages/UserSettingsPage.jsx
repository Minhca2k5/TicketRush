import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, Mail, Monitor, RotateCcw, Save, ShieldCheck, Ticket } from 'lucide-react';
import { getProfile } from '../services/authService';
import { defaultUserSettings, getUserSettingsStorageKey } from '../lib/userSettings';
import './UserSettingsPage.css';

function ToggleRow({ icon: Icon, title, description, checked, onChange }) {
  return (
    <div className="user-settings-toggle-row">
      <div className="user-settings-row-copy">
        <span className="user-settings-row-icon"><Icon size={18} /></span>
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </div>
      <button
        type="button"
        className={`user-settings-toggle ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span />
      </button>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <section className="user-settings-card">
      <div className="user-settings-card-header">
        <span><Icon size={20} /></span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="user-settings-card-body">
        {children}
      </div>
    </section>
  );
}

export default function UserSettingsPage() {
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(defaultUserSettings);
  const [savedAt, setSavedAt] = useState('');

  const storageKey = useMemo(() => getUserSettingsStorageKey(profile), [profile]);

  useEffect(() => {
    let isActive = true;

    getProfile()
      .then((user) => {
        if (isActive) setProfile(user);
      })
      .catch(() => {
        if (isActive) setProfile(null);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      setSettings({ ...defaultUserSettings, ...(saved || {}) });
    } catch {
      setSettings(defaultUserSettings);
    }
  }, [storageKey]);

  const setField = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedAt('');
  };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleReset = () => {
    setSettings(defaultUserSettings);
    localStorage.removeItem(storageKey);
    setSavedAt('');
  };

  return (
    <div className="user-settings-page">
      <main className="user-settings-shell">
        <div className="user-settings-hero">
          <div>
            <span className="user-settings-eyebrow">Preferences</span>
            <h1>Account settings</h1>
            <p>Control how TicketRush keeps you updated and how booking tools behave for your account.</p>
          </div>
          <div className="user-settings-account">
            <div className="user-settings-avatar">
              {(profile?.username || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{profile?.username || 'User'}</strong>
              <p>{profile?.email || 'Signed in account'}</p>
            </div>
          </div>
        </div>

        {savedAt && (
          <div className="user-settings-saved">
            <ShieldCheck size={18} />
            Settings saved at {savedAt}.
          </div>
        )}

        <div className="user-settings-grid">
          <SettingsCard
            icon={Bell}
            title="Notifications"
            description="Choose which updates should reach you while using TicketRush."
          >
            <ToggleRow
              icon={Mail}
              title="Email notifications"
              description="Receive account, checkout, and verification updates by email."
              checked={settings.emailNotifications}
              onChange={(value) => setField('emailNotifications', value)}
            />
            <ToggleRow
              icon={CalendarClock}
              title="Booking reminders"
              description="Show reminders before held seats expire."
              checked={settings.bookingReminders}
              onChange={(value) => setField('bookingReminders', value)}
            />
            <ToggleRow
              icon={Ticket}
              title="Ticket updates"
              description="Notify you when tickets or order status changes."
              checked={settings.ticketUpdates}
              onChange={(value) => setField('ticketUpdates', value)}
            />
          </SettingsCard>

          <SettingsCard
            icon={Monitor}
            title="Experience"
            description="Tune your personal browsing and ticket display preferences."
          >
            <label className="user-settings-field">
              <span>Default start page</span>
              <select value={settings.defaultView} onChange={(event) => setField('defaultView', event.target.value)}>
                <option value="events">Events</option>
                <option value="tickets">My Tickets</option>
                <option value="profile">Profile</option>
              </select>
            </label>

            <label className="user-settings-field">
              <span>Hold reminder</span>
              <select value={settings.holdReminderMinutes} onChange={(event) => setField('holdReminderMinutes', Number(event.target.value))}>
                <option value={1}>1 minute before expiry</option>
                <option value={2}>2 minutes before expiry</option>
                <option value={5}>5 minutes before expiry</option>
              </select>
            </label>

            <ToggleRow
              icon={Ticket}
              title="Compact ticket cards"
              description="Use a denser layout on the My Tickets page."
              checked={settings.compactTickets}
              onChange={(value) => setField('compactTickets', value)}
            />
          </SettingsCard>
        </div>

        <div className="user-settings-actions">
          <button type="button" className="user-settings-secondary" onClick={handleReset}>
            <RotateCcw size={18} />
            Reset
          </button>
          <button type="button" className="user-settings-primary" onClick={handleSave}>
            <Save size={18} />
            Save settings
          </button>
        </div>
      </main>
    </div>
  );
}
