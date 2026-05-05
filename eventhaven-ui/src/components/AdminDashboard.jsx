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
  Wallet,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users },
  { label: 'System Reports', icon: FileBarChart2 },
  { label: 'Admin Settings', icon: Settings },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy },
  { label: 'System Status', icon: ShieldCheck },
];

function unwrapApiList(response) {
  return response.data?.data?.content || response.data?.data || response.data || [];
}

function unwrapApiObject(response) {
  return response.data?.data || response.data || {};
}

function formatDate(value) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCurrencyCompact(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function inferStatus(event) {
  if (event.status) return event.status.toUpperCase();
  if (!event.startTime) return 'DRAFT';
  return new Date(event.startTime) < new Date() ? 'LIVE' : 'PENDING';
}

function statusBadgeClass(status) {
  if (status === 'LIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'PENDING') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'PAST') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function MetricCard({ label, value, delta, icon: Icon, surface, iconBg }) {
  return (
    <article className={`rounded-[28px] border border-white/80 bg-gradient-to-br ${surface} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-4 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-3 text-xs font-semibold text-slate-600">{delta}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
    </article>
  );
}

function DistributionRows({ title, subtitle, items, valueFormatter, emptyMessage, barClass = 'bg-violet-500' }) {
  const peak = Math.max(...items.map((item) => Number(item.amount || item.count || 0)), 1);

  return (
    <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

      {items.length === 0 ? (
        <div className="mt-6 flex h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {items.map((item) => {
            const metric = Number(item.amount || item.count || 0);
            const width = Math.max((metric / peak) * 100, metric > 0 ? 8 : 0);
            return (
              <div key={item.label} className="rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.label}</p>
                    {item.meta ? <p className="mt-1 text-xs text-slate-500">{item.meta}</p> : null}
                  </div>
                  <p className="text-sm font-bold text-slate-700">{valueFormatter(item)}</p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DemographicsPanel({ demographics }) {
  const genderBreakdown = demographics?.available ? demographics.genderBreakdown || [] : [];
  const ageBreakdown = demographics?.available ? demographics.ageBreakdown || [] : [];
  const note = demographics?.note || 'No customer profile data is available yet.';

  const renderBreakdown = (items, accentClass) => {
    const peak = Math.max(...items.map((item) => Number(item.count || 0)), 1);

    return items.length === 0 ? (
      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-400">
        No demographic data yet.
      </div>
    ) : (
      <div className="space-y-3">
        {items.map((item) => {
          const width = Math.max((Number(item.count || 0) / peak) * 100, item.count > 0 ? 8 : 0);
          return (
            <div key={item.label} className="rounded-[20px] border border-slate-100 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-900">{item.label}</p>
                <p className="text-xs font-semibold text-slate-600">
                  {formatNumber(item.count)} users · {formatPercentage(item.percentage)}
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <h2 className="text-xl font-black text-slate-950">Audience Demographics</h2>
      <p className="mt-2 text-sm text-slate-500">{note}</p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Gender Split</h3>
          <div className="mt-3">{renderBreakdown(genderBreakdown, 'bg-violet-500')}</div>
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">Age Groups</h3>
          <div className="mt-3">{renderBreakdown(ageBreakdown, 'bg-sky-500')}</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [events, setEvents] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError('');

        const [eventsResponse, revenueResponse, occupancyResponse, demographicsResponse] = await Promise.all([
          api.get('/events'),
          api.get('/dashboard/revenue'),
          api.get('/dashboard/occupancy'),
          api.get('/dashboard/demographics'),
        ]);

        if (ignore) return;

        setEvents(Array.isArray(unwrapApiList(eventsResponse)) ? unwrapApiList(eventsResponse) : []);
        setRevenue(unwrapApiObject(revenueResponse));
        setOccupancy(unwrapApiObject(occupancyResponse));
        setDemographics(unwrapApiObject(demographicsResponse));
      } catch {
        if (!ignore) {
          setEvents([]);
          setRevenue(null);
          setOccupancy(null);
          setDemographics(null);
          setError('Unable to load live dashboard analytics from the Event Service.');
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

  const occupancyLookup = useMemo(
    () =>
      new Map((occupancy?.events || []).map((item) => [item.eventId, item])),
    [occupancy]
  );

  const liveEvents = useMemo(
    () => events.filter((event) => inferStatus(event) === 'LIVE').length,
    [events]
  );

  const dashboardMetrics = useMemo(() => {
    const topGender = demographics?.available && demographics.genderBreakdown?.length
      ? demographics.genderBreakdown[0].label
      : 'No customer profile data';

    return [
      {
        label: 'Total Revenue',
        value: formatCurrencyCompact(revenue?.totalRevenue),
        delta: `${formatNumber(revenue?.soldTickets)} sold tickets recorded`,
        icon: Wallet,
        surface: 'from-sky-50 to-blue-50',
        iconBg: 'bg-sky-100 text-sky-600',
      },
      {
        label: 'Tickets Sold',
        value: formatNumber(occupancy?.soldSeats),
        delta: `${formatNumber(occupancy?.availableSeats)} seats still available`,
        icon: Ticket,
        surface: 'from-emerald-50 to-green-50',
        iconBg: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'Overall Occupancy',
        value: formatPercentage(occupancy?.occupancyRate),
        delta: `${liveEvents} live events in the current catalog`,
        icon: TrendingUp,
        surface: 'from-fuchsia-50 to-violet-50',
        iconBg: 'bg-violet-100 text-violet-600',
      },
      {
        label: 'Registered Customers',
        value: formatNumber(demographics?.totalCustomers),
        delta: demographics?.available ? `Largest segment: ${topGender}` : 'Customer profile sync unavailable',
        icon: Users,
        surface: 'from-amber-50 to-orange-50',
        iconBg: 'bg-amber-100 text-amber-600',
      },
    ];
  }, [demographics, liveEvents, occupancy, revenue]);

  const revenueByEvent = useMemo(
    () =>
      (revenue?.events || []).slice(0, 6).map((item) => ({
        label: item.eventName,
        amount: item.revenue,
        meta: `${formatNumber(item.soldTickets)} sold · ${item.category}`,
      })),
    [revenue]
  );

  const occupancyByEvent = useMemo(
    () =>
      (occupancy?.events || []).slice(0, 6).map((item) => ({
        label: item.eventName,
        amount: item.occupancyRate,
        meta: `${item.soldSeats}/${item.totalSeats} seats filled · ${item.venueName}`,
      })),
    [occupancy]
  );

  const recentEvents = useMemo(
    () =>
      [...events]
        .sort((first, second) => new Date(second.startTime || 0) - new Date(first.startTime || 0))
        .slice(0, 6),
    [events]
  );

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
          <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[#dde6f0] bg-white/85 px-6 py-5 backdrop-blur-xl lg:px-8">
            <div className="flex max-w-xl flex-1 items-center gap-3 rounded-2xl border border-[#dbe3ef] bg-[#f9fbff] px-4 py-3 text-slate-400">
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
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-fuchsia-300 to-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                  AU
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">Admin User</p>
                  <p className="text-xs text-slate-500">Super Admin</p>
                </div>
              </div>
            </div>
          </header>

          <main className="px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Event Overview Dashboard</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Revenue, occupancy, and customer profile insights pulled directly from the Event Service.
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/events')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500"
              >
                <CalendarDays size={16} />
                Open Events Management
              </button>
            </div>

            {error ? (
              <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-700">
                {error}
              </div>
            ) : null}

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {dashboardMetrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <DistributionRows
                title="Revenue by Event"
                subtitle="Recognized revenue from seats that have already been sold."
                items={loading ? [] : revenueByEvent}
                valueFormatter={(item) => formatCurrency(item.amount)}
                emptyMessage={loading ? 'Loading revenue analytics...' : 'No sold tickets yet, so revenue is still zero.'}
                barClass="bg-violet-500"
              />

              <DistributionRows
                title="Occupancy by Event"
                subtitle="Live fill-rate snapshot based on sold seats versus total generated inventory."
                items={loading ? [] : occupancyByEvent}
                valueFormatter={(item) => formatPercentage(item.amount)}
                emptyMessage={loading ? 'Loading occupancy analytics...' : 'No event seat inventory is available yet.'}
                barClass="bg-sky-500"
              />
            </section>

            <section className="mt-6">
              <DemographicsPanel
                demographics={
                  loading
                    ? { available: false, note: 'Loading customer profile analytics...' }
                    : demographics || { available: false, note: 'No demographics returned from the dashboard API.' }
                }
              />
            </section>

            <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-2xl font-black text-slate-950">Recent Event Submissions</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Latest events alongside their current seat fill snapshot from the live inventory service.
                </p>
              </div>

              {loading ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">Loading dashboard events...</div>
              ) : recentEvents.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">No events available yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[1040px] w-full">
                    <thead className="bg-slate-50/90">
                      <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-6 py-4">Event</th>
                        <th className="px-4 py-4">Organizer</th>
                        <th className="px-4 py-4">Location</th>
                        <th className="px-4 py-4">Date</th>
                        <th className="px-4 py-4">Seat Fill</th>
                        <th className="px-4 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.map((event) => {
                        const status = inferStatus(event);
                        const occupancyItem = occupancyLookup.get(event.id);
                        return (
                          <tr key={event.id} className="border-t border-slate-100 text-sm text-slate-600">
                            <td className="px-6 py-5 font-semibold text-slate-950">{event.name}</td>
                            <td className="px-4 py-5">{event.organizer || 'TicketRush Organizer'}</td>
                            <td className="px-4 py-5">{event.venue?.name || event.location || 'Venue TBD'}</td>
                            <td className="px-4 py-5">{formatDate(event.startTime)}</td>
                            <td className="px-4 py-5">
                              {occupancyItem ? (
                                <div>
                                  <p className="font-semibold text-slate-900">{formatPercentage(occupancyItem.occupancyRate)}</p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {occupancyItem.soldSeats}/{occupancyItem.totalSeats} seats sold
                                  </p>
                                </div>
                              ) : (
                                <span className="text-slate-400">--</span>
                              )}
                            </td>
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
