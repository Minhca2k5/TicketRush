import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  FileBarChart2,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserMenu } from '../../components/UserMenu';
import { getAuthDashboardSummary, getAuthSettings, getAuthUsers } from '../../services/authService';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users, to: '/admin/customers' },
  { label: 'System Reports', icon: FileBarChart2, to: '/admin/reports' },
  { label: 'Admin Settings', icon: Settings, to: '/admin/settings' },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy },
  { label: 'System Status', icon: ShieldCheck },
];

const pageConfig = {
  customers: {
    title: 'Customer Database',
    subtitle: 'Browse customer profile coverage and prepare audience exports for the demo.',
    icon: Users,
    stats: [
      ['Profile fields', 'Username, email, role, age, gender'],
      ['Source service', 'Auth Service'],
      ['Demo check', 'Update age/gender from Profile UI'],
    ],
  },
  reports: {
    title: 'System Reports',
    subtitle: 'Review gateway, queue, and service readiness notes before the final walkthrough.',
    icon: FileBarChart2,
    stats: [
      ['Gateway routes', 'Auth, Events, Booking, Queue'],
      ['Trace header', 'X-Trace-Id'],
      ['Queue identity', 'X-User-Id from JWT'],
    ],
  },
  settings: {
    title: 'Admin Settings',
    subtitle: 'Verify operational settings that matter for the Auth and Gateway demo.',
    icon: Settings,
    stats: [
      ['Admin account', 'admin / admin123'],
      ['JWT lifetime', '24 hours'],
      ['Frontend gateway', 'http://localhost:8080'],
    ],
  },
};

export default function AdminUtilityPage({ type }) {
  const navigate = useNavigate();
  const location = useLocation();
  const config = pageConfig[type] || pageConfig.customers;
  const PageIcon = config.icon;
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadAdminData() {
      setLoading(true);
      setError('');
      try {
        const [userData, summaryData, settingsData] = await Promise.all([
          getAuthUsers(),
          getAuthDashboardSummary(),
          getAuthSettings(),
        ]);
        if (!ignore) {
          setUsers(Array.isArray(userData) ? userData : []);
          setSummary(summaryData || null);
          setSettings(settingsData || null);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || 'Unable to load admin data from Auth Service.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadAdminData();
    return () => {
      ignore = true;
    };
  }, []);

  const completedProfiles = summary?.profileCompletionCount || 0;
  const profileCompletionRate = summary?.userCount
    ? Math.round((completedProfiles / summary.userCount) * 100)
    : 0;
  const customerRows = useMemo(() => users.filter((user) => user.role === 'CUSTOMER'), [users]);

  const liveStats = {
    customers: [
      ['Customers', customerRows.length],
      ['Completed profiles', completedProfiles],
      ['Profile completion', `${profileCompletionRate}%`],
    ],
    reports: [
      ['Gateway routes', '4 active routes'],
      ['Registered users', summary?.userCount || 0],
      ['Trace header', 'X-Trace-Id enabled'],
    ],
    settings: [
      ['Admin account', settings?.seededAdminUsername || 'admin'],
      ['JWT lifetime', settings?.jwtExpirationMs ? `${Math.round(settings.jwtExpirationMs / 3600000)} hours` : '24 hours'],
      ['Password encoding', settings?.passwordEncoding || 'BCrypt'],
    ],
  };

  const renderCustomerDatabase = () => (
    <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-xl font-black text-slate-950">Customer Profiles</h2>
        <p className="mt-2 text-sm text-slate-500">Live user records from Auth Service, excluding admin accounts.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full">
          <thead className="bg-slate-50/90">
            <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              <th className="px-6 py-4">Username</th>
              <th className="px-4 py-4">Email</th>
              <th className="px-4 py-4">Age</th>
              <th className="px-4 py-4">Gender</th>
              <th className="px-4 py-4">Profile</th>
            </tr>
          </thead>
          <tbody>
            {customerRows.map((user) => {
              const complete = user.age && user.gender;
              return (
                <tr key={user.id} className="border-t border-slate-100 text-sm text-slate-600">
                  <td className="px-6 py-5 font-bold text-slate-950">{user.username}</td>
                  <td className="px-4 py-5">{user.email}</td>
                  <td className="px-4 py-5">{user.age || 'Not set'}</td>
                  <td className="px-4 py-5">{user.gender || 'Not set'}</td>
                  <td className="px-4 py-5">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                      complete ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}>
                      {complete ? 'Complete' : 'Incomplete'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!customerRows.length && (
        <div className="px-6 py-12 text-center text-sm text-slate-500">No customer accounts have been registered yet.</div>
      )}
    </section>
  );

  const renderSystemReports = () => (
    <section className="mt-6 grid gap-6 xl:grid-cols-2">
      <article className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <h2 className="text-xl font-black text-slate-950">Gateway Readiness</h2>
        <div className="mt-5 space-y-3 text-sm font-semibold text-slate-600">
          {['/auth/** -> auth-service', '/api/events/** -> event-service', '/api/booking/** -> booking-service', '/api/queue/** -> queue-service'].map((route) => (
            <div key={route} className="rounded-2xl bg-slate-50 px-4 py-3">{route}</div>
          ))}
        </div>
      </article>
      <article className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <h2 className="text-xl font-black text-slate-950">Auth Metrics</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-violet-50 p-4">
            <p className="text-sm font-bold text-violet-700">Admins</p>
            <p className="mt-2 text-3xl font-black text-violet-950">{summary?.adminCount || 0}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-700">Customers</p>
            <p className="mt-2 text-3xl font-black text-emerald-950">{summary?.customerCount || 0}</p>
          </div>
        </div>
      </article>
    </section>
  );

  const renderAdminSettings = () => (
    <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <h2 className="text-xl font-black text-slate-950">Auth Configuration</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          ['Service', settings?.serviceName || 'auth-service'],
          ['Seeded admin username', settings?.seededAdminUsername || 'admin'],
          ['Seeded admin email', settings?.seededAdminEmail || 'admin@ticketrush.local'],
          ['JWT expiration', settings?.jwtExpirationMs ? `${settings.jwtExpirationMs} ms` : '86400000 ms'],
          ['Password encoding', settings?.passwordEncoding || 'BCrypt'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-2 text-base font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const renderBody = () => {
    if (loading) {
      return <div className="mt-6 rounded-[28px] bg-white px-6 py-16 text-center text-sm text-slate-500">Loading admin data...</div>;
    }
    if (error) {
      return <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-semibold text-amber-800">{error}</div>;
    }
    if (type === 'customers') return renderCustomerDatabase();
    if (type === 'reports') return renderSystemReports();
    return renderAdminSettings();
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-sans text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-r border-[#dde6f0] bg-white">
          <div className="flex items-center gap-4 border-b border-[#e8edf4] px-8 py-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
              <Ticket size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-950">TicketRush</p>
              <p className="text-sm text-slate-500">Admin Portal</p>
            </div>
          </div>

          <div className="px-5 py-7">
            <p className="px-4 text-xs font-bold uppercase tracking-[0.25em] text-slate-400">Main</p>
            <div className="mt-4 space-y-2">
              {sidebarMain.map(({ label, icon: Icon, to }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate(to)}
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
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <PageIcon size={20} />
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">{config.title}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">{config.subtitle}</p>
            </div>
            <UserMenu />
          </div>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            {(liveStats[type] || config.stats).map(([label, value]) => (
              <article key={label} className="rounded-[24px] border border-[#dfe7f2] bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-3 text-lg font-black text-slate-950">{value}</p>
              </article>
            ))}
          </section>

          {renderBody()}
        </main>
      </div>
    </div>
  );
}
