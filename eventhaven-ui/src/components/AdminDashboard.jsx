import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  FileBarChart2,
  LifeBuoy,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getAuthDashboardSummary } from '../services/authService';
import { UserMenu } from './UserMenu';

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

function formatDate(value) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function inferStatus(event) {
  if (event.status) return event.status.toUpperCase();
  if (!event.startTime) return 'DRAFT';
  return new Date(event.startTime) < new Date() ? 'LIVE' : 'PENDING';
}

function statusBadgeClass(status) {
  if (status === 'LIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'PENDING') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [authSummary, setAuthSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      try {
        const [eventsResponse, authData] = await Promise.all([
          api.get('/events'),
          getAuthDashboardSummary(),
        ]);
        const raw = eventsResponse.data?.data?.content || eventsResponse.data?.data || eventsResponse.data || [];
        if (!ignore) {
          setEvents(Array.isArray(raw) ? raw : []);
          setAuthSummary(authData || null);
        }
      } catch (error) {
        if (!ignore) {
          setEvents([]);
          setAuthSummary(null);
          setSummaryError(error.response?.data?.error || 'Dashboard metrics are temporarily unavailable.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      ignore = true;
    };
  }, []);

  const dashboardMetrics = useMemo(() => {
    const totalEvents = events.length;
    const liveEvents = events.filter((event) => inferStatus(event) === 'LIVE').length;
    const totalUsers = authSummary?.userCount || 0;
    const profileCompletionRate = totalUsers
      ? Math.round(((authSummary?.profileCompletionCount || 0) / totalUsers) * 100)
      : 0;

    return [
      {
        label: 'Catalog Events',
        value: totalEvents,
        delta: `${liveEvents} live now`,
        icon: BarChart3,
        surface: 'from-sky-50 to-blue-50',
        iconBg: 'bg-sky-100 text-sky-600',
      },
      {
        label: 'Registered Users',
        value: totalUsers,
        delta: `${authSummary?.customerCount || 0} customers`,
        icon: Users,
        surface: 'from-emerald-50 to-green-50',
        iconBg: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'Profile Completion',
        value: `${profileCompletionRate}%`,
        delta: `${authSummary?.profileCompletionCount || 0} complete profiles`,
        icon: ShieldCheck,
        surface: 'from-fuchsia-50 to-violet-50',
        iconBg: 'bg-violet-100 text-violet-600',
      },
      {
        label: 'Average Age',
        value: authSummary?.averageAge ? Math.round(authSummary.averageAge) : 0,
        delta: `${authSummary?.adminCount || 0} admin accounts`,
        icon: TrendingUp,
        surface: 'from-amber-50 to-orange-50',
        iconBg: 'bg-amber-100 text-amber-600',
      },
    ];
  }, [authSummary, events]);

  const recentEvents = useMemo(() => (
    [...events]
      .sort((first, second) => new Date(second.startTime || 0) - new Date(first.startTime || 0))
      .slice(0, 5)
  ), [events]);

  const demographicTotal = (authSummary?.maleCount || 0) + (authSummary?.femaleCount || 0);
  const malePercent = demographicTotal ? Math.round(((authSummary?.maleCount || 0) / demographicTotal) * 100) : 0;
  const femalePercent = demographicTotal ? 100 - malePercent : 0;

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

        <div className="min-w-0">
          <header className="hidden">
            <div className="hidden">
              <Search size={18} />
              <span className="text-sm">Search events...</span>
              <span className="ml-auto text-xs font-semibold">⌘K</span>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red-500" />
                <ShieldCheck size={18} />
              </button>
              <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100">
                <Settings size={18} />
              </button>
              <UserMenu />
            </div>
          </header>

          <main className="px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Event Overview Dashboard</h1>
                <p className="mt-2 text-sm text-slate-500">Track event inventory, users, and profile demographics from the live services.</p>
              </div>
              <button
                onClick={() => navigate('/admin/events')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500"
              >
                <CalendarDays size={16} />
                Open Events Management
              </button>
            </div>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboardMetrics.map(({ label, value, delta, icon: Icon, surface, iconBg }) => (
                <article key={label} className={`rounded-[28px] border border-white/80 bg-gradient-to-br ${surface} p-5 shadow-sm`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">{label}</p>
                      <p className="mt-4 text-3xl font-black text-slate-950">{value}</p>
                      <p className="mt-3 text-xs font-semibold text-emerald-600">{delta}</p>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconBg}`}>
                      <Icon size={18} />
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {summaryError && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {summaryError}
              </div>
            )}

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
                <h2 className="text-xl font-black text-slate-950">Audience Demographics</h2>
                <p className="mt-2 text-sm text-slate-500">Gender split from completed customer profiles.</p>
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-600">
                      <span>Male</span>
                      <span>{authSummary?.maleCount || 0} users</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${malePercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-600">
                      <span>Female</span>
                      <span>{authSummary?.femaleCount || 0} users</span>
                    </div>
                    <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${femalePercent}%` }} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
                    {demographicTotal} users have supplied demographic details.
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
                <h2 className="text-xl font-black text-slate-950">Account Mix</h2>
                <p className="mt-2 text-sm text-slate-500">Admin and customer distribution from auth-service.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-emerald-50 p-5">
                    <p className="text-sm font-bold text-emerald-700">Customers</p>
                    <p className="mt-3 text-4xl font-black text-emerald-950">{authSummary?.customerCount || 0}</p>
                  </div>
                  <div className="rounded-3xl bg-violet-50 p-5">
                    <p className="text-sm font-bold text-violet-700">Admins</p>
                    <p className="mt-3 text-4xl font-black text-violet-950">{authSummary?.adminCount || 0}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5 sm:col-span-2">
                    <p className="text-sm font-bold text-slate-600">Completed Profiles</p>
                    <p className="mt-3 text-4xl font-black text-slate-950">{authSummary?.profileCompletionCount || 0}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-2xl font-black text-slate-950">Recent Event Submissions</h2>
                <p className="mt-2 text-sm text-slate-500">Latest events and upcoming launches from the current catalog.</p>
              </div>

              {loading ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">Loading dashboard events...</div>
              ) : recentEvents.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">No events available yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[920px] w-full">
                    <thead className="bg-slate-50/90">
                      <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-6 py-4">Event</th>
                        <th className="px-4 py-4">Organizer</th>
                        <th className="px-4 py-4">Location</th>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.map((event) => {
                        const status = inferStatus(event);
                        return (
                          <tr key={event.id} className="border-t border-slate-100 text-sm text-slate-600">
                            <td className="px-6 py-5 font-semibold text-slate-950">{event.name}</td>
                            <td className="px-4 py-5">{event.organizer || 'TicketRush Organizer'}</td>
                            <td className="px-4 py-5">{event.venue?.name || event.location || 'Venue TBD'}</td>
                            <td className="px-4 py-5">{formatDate(event.startTime)}</td>
                            <td className="px-4 py-5">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${statusBadgeClass(status)}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
