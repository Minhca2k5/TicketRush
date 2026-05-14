import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  DollarSign,
  FileBarChart2,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getApiEventStatus } from '../../lib/event-status';

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

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function getEventList(eventsResponse) {
  const payload = eventsResponse?.data?.data || eventsResponse?.data || [];
  if (Array.isArray(payload?.content)) return payload.content;
  return Array.isArray(payload) ? payload : [];
}

function normalizeOrderStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (['PAID', 'COMPLETED', 'SUCCESS', 'CONFIRMED'].includes(normalized)) return 'Completed';
  if (['REFUNDED', 'CANCELLED', 'CANCELED'].includes(normalized)) return 'Refunded';
  return 'Pending';
}

function getTicketCount(order) {
  return Array.isArray(order.tickets) ? order.tickets.length : Number(order.ticketCount || 0);
}

function getEventCapacity(event) {
  return Number(event.totalSeats ?? event.seatCount ?? event.venue?.totalCapacity ?? 0);
}

function inferCategory(event) {
  const explicit = event.category || event.eventCategory;
  if (explicit) return explicit;
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  if (/concert|music|festival|orchestra/.test(text)) return 'Concert';
  if (/sport|final|arena|championship/.test(text)) return 'Sport';
  if (/conference|summit|tech/.test(text)) return 'Conference';
  if (/theater|comedy|opera|gala/.test(text)) return 'Theater';
  return 'General';
}

function ReportCard({ label, value, hint, icon: Icon, surface, iconBg }) {
  return (
    <div className={`rounded-[28px] border border-[#dfe7f2] bg-gradient-to-br ${surface} p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          <p className="mt-4 text-3xl font-black text-slate-950">{value}</p>
          <p className="mt-3 text-xs font-semibold text-slate-500">{hint}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconBg}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function HorizontalBarList({ title, description, items, emptyLabel, formatValue = (value) => value }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>

      <div className="mt-6 space-y-4">
        {items.length ? items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-slate-700">{item.label}</span>
              <span className="font-semibold text-slate-500">{formatValue(item.value)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400"
                style={{ width: `${Math.max(4, Math.round((item.value / maxValue) * 100))}%` }}
              />
            </div>
          </div>
        )) : (
          <div className="flex h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </section>
  );
}

export default function SystemReportsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadReports() {
      setLoading(true);
      setLoadError('');

      try {
        const [eventsResponse, ordersResponse] = await Promise.all([
          api.get('/events?size=200'),
          api.get('/booking/admin/orders').catch(() => null),
        ]);

        if (!ignore) {
          setEvents(getEventList(eventsResponse));
          setOrders(ordersResponse?.data?.data || ordersResponse?.data || []);
        }
      } catch (error) {
        if (!ignore) {
          setEvents([]);
          setOrders([]);
          setLoadError(error.response?.data?.message || 'Unable to load system reports.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadReports();

    return () => {
      ignore = true;
    };
  }, []);

  const report = useMemo(() => {
    const eventById = new Map(events.map((event) => [Number(event.id), event]));
    const completedOrders = orders.filter((order) => normalizeOrderStatus(order.status) === 'Completed');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + Number(order.totalPrice ?? order.amount ?? 0), 0);
    const ticketsSold = completedOrders.reduce((sum, order) => sum + getTicketCount(order), 0);
    const totalCapacity = events.reduce((sum, event) => sum + getEventCapacity(event), 0);
    const activeEvents = events.filter((event) => getApiEventStatus(event) !== 'PAST').length;
    const liveEvents = events.filter((event) => getApiEventStatus(event) === 'LIVE').length;
    const pendingEvents = events.filter((event) => getApiEventStatus(event) === 'PENDING').length;

    const categoryCounts = new Map();
    events.forEach((event) => {
      const category = inferCategory(event);
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    const statusCounts = new Map();
    events.forEach((event) => {
      const status = getApiEventStatus(event);
      const label = status === 'PAST' ? 'Past' : status.charAt(0) + status.slice(1).toLowerCase();
      statusCounts.set(label, (statusCounts.get(label) || 0) + 1);
    });

    const revenueByEvent = new Map();
    completedOrders.forEach((order) => {
      const event = eventById.get(Number(order.eventId));
      const eventName = event?.name || (order.eventId ? `Event #${order.eventId}` : 'Unassigned order');
      const current = revenueByEvent.get(eventName) || { revenue: 0, tickets: 0 };
      revenueByEvent.set(eventName, {
        revenue: current.revenue + Number(order.totalPrice ?? order.amount ?? 0),
        tickets: current.tickets + getTicketCount(order),
      });
    });

    return {
      totalRevenue,
      ticketsSold,
      totalCapacity,
      activeEvents,
      liveEvents,
      pendingEvents,
      utilization: totalCapacity ? Math.round((ticketsSold / totalCapacity) * 100) : 0,
      categoryItems: Array.from(categoryCounts.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      statusItems: Array.from(statusCounts.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      topEvents: Array.from(revenueByEvent.entries())
        .map(([eventName, metrics]) => ({ eventName, ...metrics }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6),
    };
  }, [events, orders]);

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
              <h1 className="text-3xl font-black tracking-tight text-slate-950">System Reports</h1>
              <p className="mt-2 text-sm text-slate-500">Review platform health, catalog coverage, and revenue performance from live system data.</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500"
            >
              <FileBarChart2 size={17} />
              Export Report
            </button>
          </div>

          {loadError && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white px-6 py-16 text-center text-sm text-slate-500">
              Loading system reports...
            </div>
          ) : (
            <>
              <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ReportCard
                  label="Total Revenue"
                  value={formatCurrency(report.totalRevenue)}
                  hint={`${report.ticketsSold.toLocaleString()} tickets sold`}
                  icon={DollarSign}
                  surface="from-violet-50 to-fuchsia-50"
                  iconBg="bg-violet-100 text-violet-600"
                />
                <ReportCard
                  label="Active Events"
                  value={report.activeEvents.toLocaleString()}
                  hint={`${report.liveEvents} live, ${report.pendingEvents} pending`}
                  icon={CalendarDays}
                  surface="from-sky-50 to-blue-50"
                  iconBg="bg-sky-100 text-sky-600"
                />
                <ReportCard
                  label="Seat Utilization"
                  value={`${report.utilization}%`}
                  hint={`${report.totalCapacity.toLocaleString()} seats configured`}
                  icon={Ticket}
                  surface="from-emerald-50 to-green-50"
                  iconBg="bg-emerald-100 text-emerald-600"
                />
                <ReportCard
                  label="Event Catalog"
                  value={events.length.toLocaleString()}
                  hint="Total events in system"
                  icon={TrendingUp}
                  surface="from-amber-50 to-yellow-50"
                  iconBg="bg-amber-100 text-amber-600"
                />
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-2">
                <HorizontalBarList
                  title="Events by Category"
                  description="Distribution of event types in the current catalog."
                  items={report.categoryItems}
                  emptyLabel="No category data available"
                />
                <HorizontalBarList
                  title="Events by Status"
                  description="Operational status split for the active event catalog."
                  items={report.statusItems}
                  emptyLabel="No status data available"
                />
              </section>

              <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
                <div className="border-b border-slate-100 px-6 py-5">
                  <h2 className="text-2xl font-black text-slate-950">Top Revenue Events</h2>
                  <p className="mt-2 text-sm text-slate-500">Highest grossing events based on completed ticket orders.</p>
                </div>

                {report.topEvents.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full">
                      <thead className="bg-slate-50/90">
                        <tr className="text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          <th className="px-6 py-4">Event</th>
                          <th className="px-4 py-4">Tickets Sold</th>
                          <th className="px-4 py-4">Revenue</th>
                          <th className="px-6 py-4">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.topEvents.map((event) => {
                          const share = report.totalRevenue ? Math.round((event.revenue / report.totalRevenue) * 100) : 0;
                          return (
                            <tr key={event.eventName} className="border-t border-slate-100 text-sm text-slate-600">
                              <td className="px-6 py-5 font-semibold text-slate-950">{event.eventName}</td>
                              <td className="px-4 py-5">{event.tickets.toLocaleString()}</td>
                              <td className="px-4 py-5 font-semibold text-slate-900">{formatCurrency(event.revenue)}</td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="h-2 w-32 rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-violet-600" style={{ width: `${share}%` }} />
                                  </div>
                                  <span className="font-semibold text-slate-500">{share}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-6 py-16 text-center text-sm text-slate-500">
                    No completed ticket transactions available yet.
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
