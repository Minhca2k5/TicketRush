import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  DollarSign,
  FileBarChart2,
  LifeBuoy,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Ticket,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserMenu } from '../../components/UserMenu';
import RevenueTrendChart from '../../components/admin/RevenueTrendChart';
import SalesStatCard from '../../components/admin/SalesStatCard';
import SalesTable from '../../components/admin/SalesTable';
import api from '../../services/api';
import { getAuthUsers } from '../../services/authService';

const sidebarMain = [
  { label: 'Dashboard', icon: BarChart3, to: '/admin/dashboard' },
  { label: 'Events Management', icon: CalendarDays, to: '/admin/events' },
  { label: 'Ticket Sales', icon: Ticket, to: '/admin/sales' },
  { label: 'Customer Database', icon: Users, to: '/admin/customers' },
  { label: 'System Reports', icon: FileBarChart2, to: '/admin/reports' },
  { label: 'Coupon Codes', icon: Tag, to: '/admin/coupons' },
  { label: 'Admin Settings', icon: Settings, to: '/admin/settings' },
];

const sidebarSupport = [
  { label: 'Help & Support', icon: LifeBuoy, to: '/admin/help' },
  { label: 'System Status', icon: ShieldCheck, to: '/admin/status' },
];

const timeFilters = [
  { key: 'today', label: 'Hôm nay' },
  { key: '7d', label: '7 ngày qua' },
  { key: 'month', label: 'Tháng này' },
];

const SALES_REFRESH_INTERVAL_MS = 10000;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

function parseBackendDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimeZone ? normalized : `${normalized}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = parseBackendDateTime(value);
  if (!date) return 'TBD';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function eachDayBetween(startDate, endDate) {
  const days = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getTrendDays(selectedFilter) {
  const today = startOfToday();

  if (selectedFilter === 'today') {
    return [today];
  }

  if (selectedFilter === 'month') {
    return eachDayBetween(startOfMonth(), today);
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  return eachDayBetween(sevenDaysAgo, today);
}

function normalizeOrderStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();

  if (['PAID', 'COMPLETED', 'SUCCESS', 'CONFIRMED'].includes(normalized)) return 'Completed';
  if (['PENDING', 'HELD', 'PROCESSING'].includes(normalized)) return 'Pending';
  if (['CANCELLED', 'CANCELED'].includes(normalized)) return 'Cancelled';

  return normalized ? normalized.charAt(0) + normalized.slice(1).toLowerCase() : 'Pending';
}

function getEventList(eventsResponse) {
  const payload = eventsResponse?.data?.data || eventsResponse?.data || [];
  if (Array.isArray(payload?.content)) return payload.content;
  return Array.isArray(payload) ? payload : [];
}

function getUserList(usersResponse) {
  const payload = usersResponse?.data?.data || usersResponse?.data || usersResponse || [];
  if (Array.isArray(payload?.content)) return payload.content;
  return Array.isArray(payload) ? payload : [];
}

function getCustomerName(userId, usersByHolderId) {
  const rawUserId = String(userId || '').trim();
  if (!rawUserId) return 'Unknown customer';
  return usersByHolderId.get(rawUserId) || rawUserId;
}

function transformOrder(order, eventsById, usersByHolderId) {
  const ticketCount = Array.isArray(order.tickets) ? order.tickets.length : Number(order.ticketCount || 0);
  const status = normalizeOrderStatus(order.status);
  const event = eventsById.get(Number(order.eventId));

  return {
    id: order.id,
    orderId: `#ORD-${String(order.id || 0).padStart(4, '0')}`,
    eventName: event?.name || event?.title || (order.eventId ? `Event #${order.eventId}` : 'Ticket order'),
    customer: getCustomerName(order.userId, usersByHolderId),
    createdAt: order.createdAt,
    amount: Number(order.totalPrice ?? order.amount ?? 0),
    status,
    ticketCount,
  };
}

export default function TicketSalesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedFilter, setSelectedFilter] = useState('7d');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadSalesData({ showLoading = false } = {}) {
      if (showLoading) {
        setLoading(true);
      }
      setLoadError('');

      try {
        const [ordersResponse, eventsResponse, usersResponse] = await Promise.all([
          api.get('/booking/admin/orders'),
          api.get('/events').catch(() => null),
          getAuthUsers().catch(() => []),
        ]);

        const rawOrders = ordersResponse.data?.data || ordersResponse.data || [];
        const eventsById = new Map(
          getEventList(eventsResponse).map((event) => [Number(event.id), event])
        );
        const usersByHolderId = new Map(
          getUserList(usersResponse).map((user) => [`user-${user.id}`, user.username || user.email || `User ${user.id}`])
        );
        const mappedOrders = (Array.isArray(rawOrders) ? rawOrders : []).map((order) => transformOrder(order, eventsById, usersByHolderId));

        if (!ignore) setOrders(mappedOrders);
      } catch (error) {
        if (!ignore) {
          setOrders([]);
          setLoadError(error.response?.data?.message || 'Unable to load ticket sales data.');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSalesData({ showLoading: true });

    const refreshInterval = window.setInterval(() => {
      loadSalesData();
    }, SALES_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSalesData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ignore = true;
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const today = startOfToday();

    return orders.filter((order) => {
      const createdAt = parseBackendDateTime(order.createdAt);
      if (!createdAt) return selectedFilter !== 'today';

      if (selectedFilter === 'today') {
        return createdAt >= today;
      }

      if (selectedFilter === 'month') {
        return createdAt >= startOfMonth();
      }

      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return createdAt >= sevenDaysAgo;
    });
  }, [orders, selectedFilter]);

  const stats = useMemo(() => {
    const completedOrders = filteredOrders.filter((order) => order.status === 'Completed');
    const pendingOrders = filteredOrders.filter((order) => order.status === 'Pending');
    const completedRevenue = completedOrders.reduce((sum, order) => sum + order.amount, 0);
    const soldTickets = completedOrders.reduce((sum, order) => sum + order.ticketCount, 0);
    const averageOrderValue = completedOrders.length ? Math.round(completedRevenue / completedOrders.length) : 0;

    return [
      {
        label: 'Total Revenue',
        value: formatCurrency(completedRevenue),
        hint: `${completedOrders.length} completed orders`,
        icon: DollarSign,
        surface: 'from-violet-50 to-fuchsia-50',
        iconBg: 'bg-violet-100 text-violet-600',
      },
      {
        label: 'Tickets Sold',
        value: soldTickets.toLocaleString(),
        hint: 'Successful tickets delivered',
        icon: Ticket,
        surface: 'from-sky-50 to-blue-50',
        iconBg: 'bg-sky-100 text-sky-600',
      },
      {
        label: 'Average Order Value',
        value: formatCurrency(averageOrderValue),
        hint: 'Based on completed orders',
        icon: CreditCard,
        surface: 'from-emerald-50 to-green-50',
        iconBg: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'Pending Orders',
        value: pendingOrders.length.toLocaleString(),
        hint: 'Awaiting payment or confirmation',
        icon: Receipt,
        surface: 'from-amber-50 to-yellow-50',
        iconBg: 'bg-amber-100 text-amber-600',
      },
    ];
  }, [filteredOrders]);

  const trendData = useMemo(() => {
    const grouped = filteredOrders.reduce((accumulator, order) => {
      const createdAt = parseBackendDateTime(order.createdAt);
      if (!createdAt) return accumulator;

      const key = getDateKey(createdAt);
      accumulator[key] = (accumulator[key] || 0) + (order.status === 'Completed' ? order.amount : 0);
      return accumulator;
    }, {});

    const points = getTrendDays(selectedFilter).map((date) => {
      const key = getDateKey(date);
      return {
        label: getDateLabel(date),
        value: grouped[key] || 0,
      };
    });

    return points.length ? points : [{ label: 'No data', value: 0 }];
  }, [filteredOrders, selectedFilter]);

  const recentOrders = useMemo(() => (
    [...filteredOrders].sort((first, second) => (
      (parseBackendDateTime(second.createdAt)?.getTime() || 0)
      - (parseBackendDateTime(first.createdAt)?.getTime() || 0)
    ))
  ), [filteredOrders]);

  const topEventName = useMemo(() => {
    const revenueByEvent = new Map();

    filteredOrders
      .filter((order) => order.status === 'Completed')
      .forEach((order) => {
        revenueByEvent.set(order.eventName, (revenueByEvent.get(order.eventName) || 0) + order.amount);
      });

    return Array.from(revenueByEvent.entries())
      .sort((first, second) => second[1] - first[1])[0]?.[0] || 'No transactions yet';
  }, [filteredOrders]);

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
              {sidebarSupport.map(({ label, icon: Icon, to }) => {
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
        </aside>

        <div className="min-w-0">
          <header className="hidden">
            <div className="hidden">
              <Search size={18} />
              <span className="text-sm">Search ticket orders...</span>
              <span className="ml-auto text-xs font-semibold">Ctrl K</span>
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
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">Ticket Sales Analysis</h1>
                <p className="mt-2 text-sm text-slate-500">Monitor revenue, completed orders, and pending activity across the latest ticket transactions.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setSelectedFilter(filter.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedFilter === filter.key ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {loadError && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {loadError}
              </div>
            )}

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((card) => (
                <SalesStatCard key={card.label} {...card} />
              ))}
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
              <RevenueTrendChart data={trendData} formatCurrency={formatCurrency} />

              <div className="rounded-[28px] border border-[#dfe7f2] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Sales Summary</h2>
                    <p className="mt-2 text-sm text-slate-500">Quick health check for ticket transactions.</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                    <TrendingUp size={18} />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Completed Orders</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">
                          {recentOrders.filter((order) => order.status === 'Completed').length}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <Receipt size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Pending Orders</p>
                        <p className="mt-2 text-2xl font-black text-slate-950">
                          {recentOrders.filter((order) => order.status === 'Pending').length}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                        <CreditCard size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-500">Top Event</p>
                        <p className="mt-2 text-lg font-black text-slate-950">{topEventName}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                        <BarChart3 size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-[28px] border border-[#dfe7f2] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Recent Ticket Transactions</h2>
                  <p className="mt-2 text-sm text-slate-500">Latest completed, pending, and cancelled orders from the admin sales feed.</p>
                </div>
              </div>

              {loading ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  Loading ticket sales data...
                </div>
              ) : (
                <SalesTable
                  orders={recentOrders}
                  formatDateTime={formatDateTime}
                  formatCurrency={formatCurrency}
                />
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
