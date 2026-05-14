import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  FileBarChart2,
  LifeBuoy,
  LockKeyhole,
  Save,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'ticketrush-admin-settings';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users },
  { label: 'System Reports', icon: FileBarChart2, to: '/admin/reports' },
  { label: 'Admin Settings', icon: Settings, to: '/admin/settings' },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy },
  { label: 'System Status', icon: ShieldCheck },
];

const defaultSettings = {
  organizationName: 'TicketRush',
  supportEmail: 'support@ticketrush.local',
  defaultCurrency: 'USD',
  timezone: 'Asia/Saigon',
  bookingHoldMinutes: 10,
  maxTicketsPerOrder: 8,
  autoApproveEvents: false,
  requireSeatMap: true,
  emailNotifications: true,
  salesAlerts: true,
  refundAlerts: true,
  twoFactorRequired: false,
  sessionTimeoutMinutes: 60,
};

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {hint ? <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    />
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    />
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 text-left transition hover:border-violet-200 hover:bg-white"
    >
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span>
      </span>
      <span className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-violet-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function SettingsSection({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [settings, setSettings] = useState(defaultSettings);
  const [savedAt, setSavedAt] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        setSettings({ ...defaultSettings, ...saved });
      }
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  const setField = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(defaultSettings);
    setSavedAt('');
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] self-start flex-col overflow-y-auto border-r border-[#dde6f0] bg-white lg:flex">
          <div className="px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Main</p>
            <div className="mt-4 space-y-2">
              {sidebarMain.map(({ label, icon: Icon, to }) => {
                const isActive = to ? location.pathname.startsWith(to) : false;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => to && navigate(to)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      isActive ? 'bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.35)]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto border-t border-[#e8edf4] px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Support</p>
            <div className="mt-4 space-y-2">
              {sidebarSupport.map(({ label, icon: Icon }) => (
                <button key={label} type="button" className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                  <Icon size={17} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-6 py-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950">Admin Settings</h1>
              <p className="mt-2 text-sm text-slate-500">Configure platform defaults, operational rules, alerts, and admin security preferences.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:text-violet-700"
              >
                Reset Defaults
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500"
              >
                <Save size={17} />
                Save Settings
              </button>
            </div>
          </div>

          {savedAt ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              Settings saved at {savedAt}.
            </div>
          ) : null}

          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <SettingsSection
              icon={Settings}
              title="Organization"
              description="Basic platform identity and regional defaults used across admin screens."
            >
              <Field label="Organization name">
                <TextInput value={settings.organizationName} onChange={(event) => setField('organizationName', event.target.value)} />
              </Field>
              <Field label="Support email">
                <TextInput type="email" value={settings.supportEmail} onChange={(event) => setField('supportEmail', event.target.value)} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Default currency">
                  <SelectInput value={settings.defaultCurrency} onChange={(event) => setField('defaultCurrency', event.target.value)}>
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                    <option value="EUR">EUR</option>
                  </SelectInput>
                </Field>
                <Field label="Timezone">
                  <SelectInput value={settings.timezone} onChange={(event) => setField('timezone', event.target.value)}>
                    <option value="Asia/Saigon">Asia/Saigon</option>
                    <option value="UTC">UTC</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                  </SelectInput>
                </Field>
              </div>
            </SettingsSection>

            <SettingsSection
              icon={WalletCards}
              title="Ticketing Rules"
              description="Control checkout limits and the operational requirements for event publishing."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Seat hold minutes">
                  <TextInput type="number" min="1" value={settings.bookingHoldMinutes} onChange={(event) => setField('bookingHoldMinutes', Number(event.target.value))} />
                </Field>
                <Field label="Max tickets per order">
                  <TextInput type="number" min="1" value={settings.maxTicketsPerOrder} onChange={(event) => setField('maxTicketsPerOrder', Number(event.target.value))} />
                </Field>
              </div>
              <Toggle
                checked={settings.autoApproveEvents}
                onChange={(value) => setField('autoApproveEvents', value)}
                label="Auto-approve new events"
                hint="Allow events to go live without manual admin approval."
              />
              <Toggle
                checked={settings.requireSeatMap}
                onChange={(value) => setField('requireSeatMap', value)}
                label="Require seat map before publishing"
                hint="Prevent admins from publishing events without configured seats."
              />
            </SettingsSection>

            <SettingsSection
              icon={Bell}
              title="Notifications"
              description="Choose which operational alerts should be surfaced to administrators."
            >
              <Toggle
                checked={settings.emailNotifications}
                onChange={(value) => setField('emailNotifications', value)}
                label="Email notifications"
                hint="Send important platform alerts to the support email."
              />
              <Toggle
                checked={settings.salesAlerts}
                onChange={(value) => setField('salesAlerts', value)}
                label="Sales milestone alerts"
                hint="Notify admins when high-volume events cross sales thresholds."
              />
              <Toggle
                checked={settings.refundAlerts}
                onChange={(value) => setField('refundAlerts', value)}
                label="Refund alerts"
                hint="Flag refunded or cancelled orders for admin review."
              />
            </SettingsSection>

            <SettingsSection
              icon={LockKeyhole}
              title="Security"
              description="Admin access controls for account protection and session behavior."
            >
              <Toggle
                checked={settings.twoFactorRequired}
                onChange={(value) => setField('twoFactorRequired', value)}
                label="Require two-factor authentication"
                hint="Require admin accounts to verify with a second factor at login."
              />
              <Field label="Session timeout minutes" hint="Admins will be asked to sign in again after this period of inactivity.">
                <TextInput type="number" min="5" value={settings.sessionTimeoutMinutes} onChange={(event) => setField('sessionTimeoutMinutes', Number(event.target.value))} />
              </Field>
            </SettingsSection>
          </section>
        </main>
      </div>
    </div>
  );
}
